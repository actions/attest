// Extension: release-cutter
//
// A canvas that walks you through cutting a new release of the action:
//   1. Pick the next v-prefixed semver tag (patch / minor / major bump).
//   2. Generate release notes from the commits since the last release, with
//      dependabot dev-dependency and GitHub Actions bumps pre-excluded.
//   3. Curate the notes (toggle lines or edit raw markdown).
//   4. Publish the GitHub Release (never a draft, never with assets), then
//      force-move the floating major tag (e.g. v4) to the new release.
//
// Wiring lives here; the changelog/gh logic is in backend.mjs and the iframe
// UI is in renderer.mjs.

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { joinSession, createCanvas, CanvasError } from "@github/copilot-sdk/extension";
import { renderHtml } from "./renderer.mjs";
import { getStatus, generateNotes, publishRelease } from "./backend.mjs";

// One loopback server per open canvas instance. Each carries a random token so
// only the iframe we handed the URL to can reach the (publish-capable) API.
const servers = new Map();

let workspacePath = process.cwd();

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let data = "";
        let settled = false;
        const finish = (fn, value) => {
            if (settled) return;
            settled = true;
            fn(value);
        };
        req.on("data", (chunk) => {
            if (settled) return;
            data += chunk;
            if (data.length > 4 * 1024 * 1024) {
                req.destroy();
                finish(reject, new Error("Request body too large"));
            }
        });
        req.on("end", () => {
            try {
                finish(resolve, data ? JSON.parse(data) : {});
            } catch (e) {
                finish(reject, e);
            }
        });
        req.on("error", (e) => finish(reject, e));
    });
}

function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(body);
}

async function handleRequest(req, res, token) {
    try {
        const url = new URL(req.url, "http://127.0.0.1");
        if (req.method === "GET" && url.pathname === "/") {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(renderHtml());
            return;
        }
        // Everything below is a state-changing / data API: require the token.
        if (url.pathname.startsWith("/api/")) {
            const provided = url.searchParams.get("t") || req.headers["x-canvas-token"];
            if (provided !== token) {
                sendJson(res, 403, { error: "Forbidden" });
                return;
            }
        }
        if (req.method === "GET" && url.pathname === "/api/status") {
            const status = await getStatus(workspacePath);
            sendJson(res, 200, status);
            return;
        }
        if (req.method === "POST" && url.pathname === "/api/notes") {
            const body = await readJsonBody(req);
            const notes = await generateNotes(workspacePath, body);
            sendJson(res, 200, notes);
            return;
        }
        if (req.method === "POST" && url.pathname === "/api/publish") {
            const body = await readJsonBody(req);
            const result = await publishRelease(workspacePath, body);
            sendJson(res, 200, result);
            return;
        }
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
    } catch (err) {
        sendJson(res, 500, { error: err?.message || String(err) });
    }
}

async function startServer() {
    const token = randomUUID();
    const server = createServer((req, res) => handleRequest(req, res, token));
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return { server, url: `http://127.0.0.1:${port}/?t=${token}` };
}

const session = await joinSession({
    canvases: [
        createCanvas({
            id: "release-cutter",
            displayName: "Cut a release",
            description:
                "Guides publishing a new GitHub Release for the action: pick the next v-semver tag, curate auto-generated notes, publish, and force-move the major tag.",
            actions: [
                {
                    name: "get_status",
                    description:
                        "Return the latest release, suggested next tags (patch/minor/major), and the floating major tag for this repo.",
                    handler: async () => {
                        try {
                            return await getStatus(workspacePath);
                        } catch (err) {
                            throw new CanvasError("status_failed", err?.message || String(err));
                        }
                    },
                },
                {
                    name: "generate_notes",
                    description:
                        "Generate and classify release notes for a tag range. Input: { tag, previousTag?, targetCommitish? }.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            tag: { type: "string", description: "The new v-prefixed semver tag, e.g. v4.2.1" },
                            previousTag: { type: "string", description: "Previous release tag to diff from" },
                            targetCommitish: { type: "string", description: "Branch or SHA the release targets" },
                        },
                        required: ["tag"],
                    },
                    handler: async (ctx) => {
                        try {
                            return await generateNotes(workspacePath, ctx.input || {});
                        } catch (err) {
                            throw new CanvasError("notes_failed", err?.message || String(err));
                        }
                    },
                },
                {
                    name: "publish_release",
                    description:
                        "Publish a GitHub Release (no assets, not a draft) and force-move the major tag. Input: { tag, name?, body?, targetCommitish? }.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            tag: { type: "string", description: "The new v-prefixed semver tag, e.g. v4.2.1" },
                            name: { type: "string", description: "Release title (defaults to the tag)" },
                            body: { type: "string", description: "Release body markdown" },
                            targetCommitish: { type: "string", description: "Branch or SHA the release targets" },
                        },
                        required: ["tag"],
                    },
                    handler: async (ctx) => {
                        try {
                            return await publishRelease(workspacePath, ctx.input || {});
                        } catch (err) {
                            throw new CanvasError("publish_failed", err?.message || String(err));
                        }
                    },
                },
            ],
            open: async (ctx) => {
                if (ctx.session?.workingDirectory) workspacePath = ctx.session.workingDirectory;
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer();
                    servers.set(ctx.instanceId, entry);
                }
                return { title: "Cut a release", url: entry.url };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    servers.delete(ctx.instanceId);
                    await new Promise((resolve) => entry.server.close(() => resolve()));
                }
            },
        }),
    ],
});

if (session.workspacePath) workspacePath = session.workspacePath;
