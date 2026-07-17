// Iframe renderer for the release-cutter canvas. Exported as a single HTML
// string. The page talks to the extension's loopback server over fetch:
//   GET  /api/status          -> initial repo/release/version data
//   POST /api/notes           -> generated + classified changelog lines
//   POST /api/publish         -> create release + move major tag
//
// The host mirrors app theme tokens onto this document, so we lean on the
// documented semantic CSS variables rather than hardcoded colors.

export function renderHtml() {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Cut a release</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 20px;
    background: var(--background-color-default, #ffffff);
    color: var(--text-color-default, #1f2328);
    font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
    font-size: var(--text-body-medium, 14px);
    line-height: var(--leading-body-medium, 20px);
  }
  h1 {
    font-size: var(--text-title-large, 22px);
    font-weight: var(--font-weight-semibold, 600);
    margin: 0 0 4px;
  }
  h2 {
    font-size: var(--text-title-small, 15px);
    font-weight: var(--font-weight-semibold, 600);
    margin: 0 0 8px;
  }
  .muted { color: var(--text-color-muted, #656d76); }
  code, .mono { font-family: var(--font-mono, ui-monospace, SFMono-Regular, Consolas, monospace); }
  a { color: var(--true-color-blue, #0969da); }
  .card {
    border: 1px solid var(--border-color-default, #d0d7de);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    background: var(--background-color-default, #fff);
  }
  .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .grow { flex: 1 1 auto; }
  label.field { display: block; margin-bottom: 4px; font-weight: var(--font-weight-semibold, 600); }
  input[type=text] {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--border-color-default, #d0d7de);
    border-radius: 6px;
    background: var(--background-color-inset, transparent);
    color: inherit;
    font: inherit;
  }
  input.mono { font-family: var(--font-mono, ui-monospace, monospace); }
  button {
    font: inherit;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--border-color-default, #d0d7de);
    background: var(--background-color-default, #f6f8fa);
    color: inherit;
    cursor: pointer;
  }
  button:hover:not(:disabled) { border-color: var(--text-color-muted, #656d76); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  button.primary {
    background: var(--true-color-green, #1f883d);
    border-color: var(--true-color-green, #1f883d);
    color: var(--color-white, #fff);
    font-weight: var(--font-weight-semibold, 600);
  }
  button.seg { padding: 5px 10px; }
  button.seg.active {
    background: var(--true-color-blue, #0969da);
    border-color: var(--true-color-blue, #0969da);
    color: var(--color-white, #fff);
  }
  .items { list-style: none; margin: 0; padding: 0; }
  .item {
    display: flex; gap: 10px; align-items: flex-start;
    padding: 8px; border-radius: 6px;
  }
  .item:hover { background: var(--background-color-inset, rgba(127,127,127,0.06)); }
  .item.excluded .item-text { text-decoration: line-through; color: var(--text-color-muted, #656d76); }
  .item input[type=checkbox] { margin-top: 3px; }
  .item-text { flex: 1 1 auto; word-break: break-word; }
  .badge {
    font-size: 11px; padding: 1px 7px; border-radius: 999px; white-space: nowrap;
    border: 1px solid var(--border-color-default, #d0d7de);
    color: var(--text-color-muted, #656d76);
  }
  .badge.dep { border-color: var(--true-color-yellow-muted, #d4a72c); }
  textarea {
    width: 100%; min-height: 240px; padding: 10px;
    border: 1px solid var(--border-color-default, #d0d7de);
    border-radius: 6px; background: var(--background-color-inset, transparent);
    color: inherit; font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 12px; line-height: 1.5;
  }
  .hint { font-size: 12px; color: var(--text-color-muted, #656d76); margin-top: 4px; }
  .banner { padding: 10px 14px; border-radius: 6px; margin-bottom: 16px; }
  .banner.err { background: var(--true-color-red-muted, rgba(207,34,46,0.12)); border: 1px solid var(--true-color-red, #cf222e); }
  .banner.ok { background: var(--true-color-green-muted, rgba(31,136,61,0.12)); border: 1px solid var(--true-color-green, #1f883d); }
  .toolbar { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
  .spacer { flex: 1 1 auto; }
  .hidden { display: none; }
</style>
</head>
<body>
  <h1>Cut a release</h1>
  <div id="subtitle" class="muted">Loading…</div>

  <div id="banner"></div>

  <div class="card" id="version-card">
    <h2>Version</h2>
    <div class="row" style="margin-bottom: 12px;">
      <div>
        <div class="muted" style="font-size:12px;">Latest release</div>
        <div id="latest" class="mono">—</div>
      </div>
      <div style="margin-left:24px;">
        <div class="muted" style="font-size:12px;">Major tag to move</div>
        <div id="major" class="mono">—</div>
      </div>
    </div>
    <div class="row" style="margin-bottom:12px;">
      <span class="muted">Bump:</span>
      <button class="seg" data-bump="patch">patch</button>
      <button class="seg" data-bump="minor">minor</button>
      <button class="seg" data-bump="major">major</button>
    </div>
    <div class="row">
      <div class="grow">
        <label class="field" for="tag">New tag</label>
        <input id="tag" type="text" class="mono" placeholder="v4.2.1" />
        <div id="tag-hint" class="hint"></div>
      </div>
      <div class="grow">
        <label class="field" for="title">Release title</label>
        <input id="title" type="text" placeholder="v4.2.1" />
      </div>
    </div>
  </div>

  <div class="card">
    <div class="row" style="margin-bottom:12px;">
      <h2 style="margin:0;">Release notes</h2>
      <div class="spacer"></div>
      <button id="regen">Generate from commits</button>
    </div>
    <div id="notes-empty" class="muted">Click “Generate from commits” to load the changes since the last release. Dependabot dev-dependency and GitHub Actions bumps are pre-unchecked.</div>
    <div id="notes-body" class="hidden">
      <div class="toolbar">
        <button id="check-all">Select all</button>
        <button id="check-none">Clear all</button>
        <div class="spacer"></div>
        <button id="toggle-edit">Edit raw markdown</button>
      </div>
      <ul id="items" class="items"></ul>
      <textarea id="raw" class="hidden"></textarea>
    </div>
  </div>

  <div class="card">
    <div class="row">
      <div class="grow muted">Creates a published release (no assets) and force-moves the major tag.</div>
      <button id="publish" class="primary" disabled>Publish release</button>
    </div>
  </div>

<script>
const $ = (id) => document.getElementById(id);
let state = { repo: "", suggested: {}, latestTag: "", footer: "", items: [], rawMode: false, rawText: "" };

// Per-instance token handed to us in the iframe URL; required on every API call.
const TOKEN = new URLSearchParams(location.search).get("t") || "";
function api(path) {
  return path + (path.includes("?") ? "&" : "?") + "t=" + encodeURIComponent(TOKEN);
}

// Banner content is built from DOM nodes (strings become text nodes) so that
// CLI/gh output interpolated into messages can never inject HTML.
function showBanner(kind, ...parts) {
  const b = $("banner");
  b.textContent = "";
  if (!kind) return;
  const div = document.createElement("div");
  div.className = "banner " + kind;
  for (const p of parts) {
    if (p == null) continue;
    div.appendChild(typeof p === "string" ? document.createTextNode(p) : p);
  }
  b.appendChild(div);
}

function mono(text) {
  const s = document.createElement("span");
  s.className = "mono";
  s.textContent = text;
  return s;
}

function isValidTag(t) { return /^v\\d+\\.\\d+\\.\\d+$/.test(t); }

function updateTagHint() {
  const t = $("tag").value.trim();
  const hint = $("tag-hint");
  if (!t) { hint.textContent = ""; }
  else if (!isValidTag(t)) { hint.textContent = "Must be v-prefixed semver, e.g. v4.2.1"; hint.style.color = "var(--true-color-red, #cf222e)"; }
  else {
    const major = "v" + t.slice(1).split(".")[0];
    hint.textContent = "Will move major tag " + major + " to this release.";
    hint.style.color = "";
  }
  refreshPublishEnabled();
  refreshSegments();
}

function refreshSegments() {
  const t = $("tag").value.trim();
  document.querySelectorAll("button.seg").forEach((b) => {
    b.classList.toggle("active", state.suggested[b.dataset.bump] === t);
  });
}

function refreshPublishEnabled() {
  $("publish").disabled = !isValidTag($("tag").value.trim());
}

function includedTexts() {
  if (state.rawMode) return null;
  return state.items.filter((i) => i.include).map((i) => i.text);
}

function composeBody() {
  if (state.rawMode) return $("raw").value;
  const inc = state.items.filter((i) => i.include).map((i) => i.text);
  const parts = [];
  if (inc.length) { parts.push("## What's Changed"); inc.forEach((t) => parts.push("* " + t)); }
  if (state.footer) { if (parts.length) parts.push(""); parts.push(state.footer); }
  return parts.join("\\n");
}

function badgeLabel(cat) {
  return { "dependabot-dev": "dev dep", "dependabot-actions": "gh actions", "dependabot-prod": "prod dep", "change": "" }[cat] || "";
}

function renderItems() {
  const ul = $("items");
  ul.innerHTML = "";
  state.items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "item" + (item.include ? "" : " excluded");
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = item.include;
    cb.addEventListener("change", () => { item.include = cb.checked; li.classList.toggle("excluded", !cb.checked); });
    const span = document.createElement("span");
    span.className = "item-text"; span.textContent = item.text;
    li.appendChild(cb); li.appendChild(span);
    const lbl = badgeLabel(item.category);
    if (lbl) {
      const badge = document.createElement("span");
      badge.className = "badge" + (item.category.startsWith("dependabot") ? " dep" : "");
      badge.textContent = lbl;
      li.appendChild(badge);
    }
    ul.appendChild(li);
  });
}

async function loadStatus() {
  try {
    const r = await fetch(api("/api/status"));
    const s = await r.json();
    if (s.error) throw new Error(s.error);
    state.repo = s.repo;
    state.suggested = s.suggested;
    state.latestTag = s.latestRelease ? s.latestRelease.tagName : "";
    const sub = $("subtitle");
    sub.textContent = "";
    sub.append("Repository ", mono(s.repo), " · default branch ", mono(s.defaultBranch));
    $("latest").textContent = s.latestRelease ? s.latestRelease.tagName : "(none)";
    $("major").textContent = s.majorTag || "—";
    $("tag").value = s.defaultTag || "";
    $("title").value = s.defaultTag || "";
    updateTagHint();
  } catch (e) {
    showBanner("err", "Failed to load repository status: " + e.message);
  }
}

async function generate() {
  const tag = $("tag").value.trim();
  if (!isValidTag(tag)) { showBanner("err", "Enter a valid tag first."); return; }
  showBanner(null);
  $("regen").disabled = true; $("regen").textContent = "Generating…";
  try {
    const r = await fetch(api("/api/notes"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag, previousTag: state.latestTag }),
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    state.items = data.items;
    state.footer = data.footer;
    state.rawMode = false;
    $("raw").classList.add("hidden");
    $("items").classList.remove("hidden");
    $("toggle-edit").textContent = "Edit raw markdown";
    $("notes-empty").classList.add("hidden");
    $("notes-body").classList.remove("hidden");
    renderItems();
    if (!state.items.length) showBanner("ok", "No commits found between " + (state.latestTag || "start") + " and " + tag + ". You can still publish an empty release or edit the notes manually.");
  } catch (e) {
    showBanner("err", "Failed to generate notes: " + e.message);
  } finally {
    $("regen").disabled = false; $("regen").textContent = "Generate from commits";
  }
}

async function publish() {
  const tag = $("tag").value.trim();
  const title = $("title").value.trim() || tag;
  if (!isValidTag(tag)) { showBanner("err", "Enter a valid tag first."); return; }
  const body = composeBody();
  const major = "v" + tag.slice(1).split(".")[0];
  if (!confirm("Publish release " + tag + " and force-move " + major + " to it?")) return;
  showBanner(null);
  $("publish").disabled = true; $("publish").textContent = "Publishing…";
  try {
    const r = await fetch(api("/api/publish"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag, name: title, body }),
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    const parts = ["Published "];
    const link = document.createElement("a");
    link.href = data.releaseUrl; link.target = "_blank"; link.rel = "noopener noreferrer";
    link.textContent = data.tag;
    parts.push(link, ".");
    if (data.movedMajor) {
      parts.push(" Moved ", mono(data.movedMajor.tag), " → ", mono(data.movedMajor.sha.slice(0, 7)), ".");
    }
    showBanner("ok", ...parts);
    $("publish").textContent = "Published";
  } catch (e) {
    showBanner("err", "Publish failed: " + e.message);
    $("publish").disabled = false; $("publish").textContent = "Publish release";
  }
}

// Wiring
document.querySelectorAll("button.seg").forEach((b) => b.addEventListener("click", () => {
  const t = state.suggested[b.dataset.bump];
  if (t) { $("tag").value = t; $("title").value = t; updateTagHint(); }
}));
$("tag").addEventListener("input", updateTagHint);
$("regen").addEventListener("click", generate);
$("publish").addEventListener("click", publish);
$("check-all").addEventListener("click", () => { state.items.forEach((i) => i.include = true); renderItems(); });
$("check-none").addEventListener("click", () => { state.items.forEach((i) => i.include = false); renderItems(); });
$("toggle-edit").addEventListener("click", () => {
  state.rawMode = !state.rawMode;
  if (state.rawMode) {
    $("raw").value = composeBody();
    $("raw").classList.remove("hidden");
    $("items").classList.add("hidden");
    $("check-all").disabled = true; $("check-none").disabled = true;
    $("toggle-edit").textContent = "Back to checklist";
  } else {
    $("raw").classList.add("hidden");
    $("items").classList.remove("hidden");
    $("check-all").disabled = false; $("check-none").disabled = false;
    $("toggle-edit").textContent = "Edit raw markdown";
  }
});

loadStatus();
</script>
</body>
</html>`;
}
