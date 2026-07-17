// Backend helpers for the release-cutter canvas.
//
// All GitHub interaction goes through the `gh` CLI (already authenticated in
// the user's environment) and `git`. Nothing here writes to disk except a
// short-lived temp file for the release notes body.

import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Run a command, resolving with stdout. Rejects with stderr on non-zero exit. */
function run(cmd, args, opts = {}) {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { maxBuffer: 16 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
            if (err) {
                const message = (stderr || err.message || "").toString().trim();
                reject(new Error(message || `${cmd} exited with an error`));
                return;
            }
            resolve(stdout.toString());
        });
    });
}

const gh = (args, opts) => run("gh", args, opts);

/** Resolve owner/repo for the workspace. Falls back to the git remote. */
export async function resolveRepo(cwd) {
    try {
        const out = await gh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], { cwd });
        const repo = out.trim();
        if (repo) return repo;
    } catch {
        // fall through to git remote parsing
    }
    const remote = (await run("git", ["remote", "get-url", "origin"], { cwd })).trim();
    const match = remote.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (!match) throw new Error(`Could not determine repository from remote: ${remote}`);
    return match[1];
}

const SEMVER = /^v(\d+)\.(\d+)\.(\d+)$/;

/** Parse a `vMAJOR.MINOR.PATCH` tag into numbers, or null. */
export function parseVersion(tag) {
    const m = typeof tag === "string" ? tag.match(SEMVER) : null;
    if (!m) return null;
    return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** Compute suggested next tags from a base version. */
export function suggestVersions(baseTag) {
    const v = parseVersion(baseTag) || { major: 0, minor: 0, patch: 0 };
    return {
        patch: `v${v.major}.${v.minor}.${v.patch + 1}`,
        minor: `v${v.major}.${v.minor + 1}.0`,
        major: `v${v.major + 1}.0.0`,
    };
}

/** The floating major tag for a version tag, e.g. v4.2.1 -> v4. */
export function majorTagFor(tag) {
    const v = parseVersion(tag);
    return v ? `v${v.major}` : null;
}

/** Gather everything the canvas needs to render its initial state. */
export async function getStatus(cwd) {
    const repo = await resolveRepo(cwd);

    let latestRelease = null;
    try {
        const out = await gh([
            "release",
            "view",
            "--repo",
            repo,
            "--json",
            "tagName,name,url,createdAt,isDraft,isPrerelease",
        ]);
        latestRelease = JSON.parse(out);
    } catch {
        latestRelease = null; // repo may have no releases yet
    }

    const defaultBranch = (
        await gh(["repo", "view", repo, "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"])
    ).trim();

    const baseTag = latestRelease?.tagName || "v0.0.0";
    const suggested = suggestVersions(baseTag);

    // Current target of the floating major tag (informational only).
    let majorTag = majorTagFor(suggested.patch);
    let majorTagSha = null;
    if (majorTag) {
        try {
            majorTagSha = (await gh(["api", `repos/${repo}/git/ref/tags/${majorTag}`, "--jq", ".object.sha"])).trim();
        } catch {
            majorTagSha = null;
        }
    }

    return {
        repo,
        defaultBranch,
        latestRelease,
        suggested,
        defaultTag: suggested.patch,
        majorTag,
        majorTagSha,
    };
}

/**
 * Classify a changelog line so we can pre-select which commits are relevant to
 * action consumers. Dependabot bumps to dev dependencies and to GitHub Actions
 * are excluded by default; everything else is included.
 */
export function classifyLine(text) {
    const isDependabot = /@dependabot(\[bot\])?/i.test(text);
    if (!isDependabot) {
        return { category: "change", include: true };
    }
    const lower = text.toLowerCase();
    // npm scoped packages (@scope/name) are dev/prod deps, not GitHub Actions,
    // so classify those before falling through to the actions heuristics.
    const isDev =
        /\bnpm-development\b/.test(lower) ||
        /development group/.test(lower) ||
        /@types\//.test(text);
    const isActions =
        /actions-(minor|major|patch)\b/.test(lower) ||
        /\bthe actions[- ]/.test(lower) ||
        /\bgithub-actions\b/.test(lower) ||
        // Bump owner/name (no leading @) is an action repo, e.g. actions/checkout.
        /\bbump\s+(?!@)[\w.-]+\/[\w.-]+\s+from\b/.test(lower);
    if (isDev) return { category: "dependabot-dev", include: false };
    if (isActions) return { category: "dependabot-actions", include: false };
    return { category: "dependabot-prod", include: true };
}

/** Split a generated-notes body into a header, item lines, and footer. */
export function parseNotesBody(body) {
    const lines = (body || "").split("\n");
    const items = [];
    let footer = "";
    for (const line of lines) {
        const trimmed = line.trimEnd();
        if (/^\*\s+/.test(trimmed)) {
            const text = trimmed.replace(/^\*\s+/, "");
            const { category, include } = classifyLine(text);
            items.push({ id: items.length, text, category, include });
        } else if (/^\*\*Full Changelog\*\*:/.test(trimmed)) {
            footer = trimmed;
        }
    }
    return { items, footer };
}

/** Ask GitHub to generate release notes for a tag range and parse them. */
export async function generateNotes(cwd, { tag, previousTag, targetCommitish }) {
    const repo = await resolveRepo(cwd);
    const args = ["api", `repos/${repo}/releases/generate-notes`, "-f", `tag_name=${tag}`];
    if (previousTag) args.push("-f", `previous_tag_name=${previousTag}`);
    if (targetCommitish) args.push("-f", `target_commitish=${targetCommitish}`);
    const out = await gh(args);
    const parsed = JSON.parse(out);
    const { items, footer } = parseNotesBody(parsed.body);
    return {
        repo,
        name: parsed.name || tag,
        items,
        footer: footer || `**Full Changelog**: https://github.com/${repo}/compare/${previousTag || ""}...${tag}`,
    };
}

/** Rebuild a release body from the selected item lines plus the footer. */
export function composeBody(includedTexts, footer) {
    const parts = [];
    if (includedTexts.length > 0) {
        parts.push("## What's Changed");
        for (const text of includedTexts) parts.push(`* ${text}`);
    }
    if (footer) {
        if (parts.length > 0) parts.push("");
        parts.push(footer);
    }
    return parts.join("\n");
}

/**
 * Publish the release (never draft, never with assets) then force-move the
 * floating major tag to the newly released commit.
 */
export async function publishRelease(cwd, { tag, name, body, targetCommitish }) {
    const repo = await resolveRepo(cwd);
    const version = parseVersion(tag);
    if (!version) throw new Error(`Tag must be a v-prefixed semver like v4.2.1 (got: ${tag})`);

    const dir = await mkdtemp(join(tmpdir(), "release-cutter-"));
    const notesFile = join(dir, "notes.md");
    await writeFile(notesFile, body ?? "", "utf8");

    try {
        const createArgs = [
            "release",
            "create",
            tag,
            "--repo",
            repo,
            "--title",
            name || tag,
            "--notes-file",
            notesFile,
        ];
        if (targetCommitish) createArgs.push("--target", targetCommitish);
        const createOut = await gh(createArgs);
        const releaseUrl = createOut.trim().split("\n").pop().trim();

        // Resolve the commit the new tag points at, then move the major tag.
        const sha = (await gh(["api", `repos/${repo}/git/ref/tags/${tag}`, "--jq", ".object.sha"])).trim();
        const majorTag = majorTagFor(tag);
        let movedMajor = null;
        if (majorTag) {
            try {
                await gh([
                    "api",
                    "-X",
                    "PATCH",
                    `repos/${repo}/git/refs/tags/${majorTag}`,
                    "-f",
                    `sha=${sha}`,
                    "-F",
                    "force=true",
                ]);
            } catch {
                // Ref may not exist yet (first release of a major) -> create it.
                await gh(["api", "-X", "POST", `repos/${repo}/git/refs`, "-f", `ref=refs/tags/${majorTag}`, "-f", `sha=${sha}`]);
            }
            movedMajor = { tag: majorTag, sha };
        }

        return { repo, tag, releaseUrl, sha, movedMajor };
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}
