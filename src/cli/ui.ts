export function renderUi(): string {
  return PAGE;
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Voice Coder</title>
<style>
  :root {
    --bg: #0f1115;
    --panel: #161a22;
    --panel-2: #1d222c;
    --line: #262c38;
    --text: #e6e7eb;
    --muted: #8a92a4;
    --accent: #7aa7ff;
    --accent-2: #4e80e6;
    --good: #5cdd8b;
    --bad: #ff7a90;
    --warn: #ffb454;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text);
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  code, pre, .mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }

  header {
    padding: 18px 24px; border-bottom: 1px solid var(--line);
    display: flex; align-items: center; gap: 12px;
    background: linear-gradient(180deg, #131722 0%, var(--bg) 100%);
  }
  header .dot {
    width: 10px; height: 10px; border-radius: 50%; background: var(--accent);
    box-shadow: 0 0 12px var(--accent);
  }
  header h1 { font-size: 17px; font-weight: 600; margin: 0; letter-spacing: 0.2px; }
  header .sub { color: var(--muted); font-size: 12px; }

  nav.tabs {
    display: flex; gap: 4px; padding: 0 24px; border-bottom: 1px solid var(--line);
    background: var(--panel);
  }
  nav.tabs button {
    background: transparent; border: 0; color: var(--muted); padding: 12px 14px;
    cursor: pointer; font: inherit; border-bottom: 2px solid transparent;
    transition: color 120ms ease, border-color 120ms ease;
  }
  nav.tabs button:hover { color: var(--text); }
  nav.tabs button.active { color: var(--text); border-bottom-color: var(--accent); }

  main { padding: 24px; max-width: 980px; margin: 0 auto; }
  .panel {
    background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
    padding: 20px; margin-bottom: 20px;
  }
  .panel h2 { margin: 0 0 6px; font-size: 15px; font-weight: 600; }
  .panel .hint { color: var(--muted); font-size: 12px; margin-bottom: 14px; }

  label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
  input[type=text], input[type=password], input[type=number], select, textarea {
    width: 100%; background: var(--panel-2); color: var(--text);
    border: 1px solid var(--line); border-radius: 6px; padding: 9px 11px; font: inherit;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  input:focus, select:focus, textarea:focus {
    outline: none; border-color: var(--accent-2); box-shadow: 0 0 0 3px rgba(78,128,230,0.18);
  }
  textarea { resize: vertical; min-height: 140px; font-family: ui-monospace, monospace; }
  .row { display: grid; gap: 14px; grid-template-columns: 1fr 1fr; margin-bottom: 14px; }
  .row.three { grid-template-columns: 1fr 1fr 1fr; }
  .field { margin-bottom: 14px; }

  button.btn {
    background: var(--accent-2); color: #fff; border: 0; border-radius: 6px;
    padding: 9px 14px; font: inherit; font-weight: 500; cursor: pointer;
    transition: background 120ms ease, transform 60ms ease;
  }
  button.btn:hover { background: var(--accent); }
  button.btn:active { transform: scale(0.98); }
  button.btn.secondary { background: var(--panel-2); border: 1px solid var(--line); color: var(--text); }
  button.btn.secondary:hover { background: #232936; }
  button.btn.danger { background: transparent; border: 1px solid var(--bad); color: var(--bad); }
  button.btn.danger:hover { background: rgba(255,122,144,0.1); }

  .toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .spacer { flex: 1; }

  .toast {
    position: fixed; bottom: 20px; right: 20px;
    background: var(--panel-2); border: 1px solid var(--line); padding: 10px 14px;
    border-radius: 6px; font-size: 13px; opacity: 0; pointer-events: none;
    transition: opacity 150ms ease, transform 150ms ease;
    transform: translateY(6px); max-width: 360px;
  }
  .toast.show { opacity: 1; transform: translateY(0); }
  .toast.ok { border-color: var(--good); }
  .toast.bad { border-color: var(--bad); }

  table.history { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.history th, table.history td {
    text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--line);
    vertical-align: top;
  }
  table.history th { color: var(--muted); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  table.history td.ts { color: var(--muted); white-space: nowrap; font-family: ui-monospace, monospace; font-size: 12px; }
  table.history td.model { color: var(--muted); white-space: nowrap; font-family: ui-monospace, monospace; font-size: 12px; }
  table.history td.text { white-space: pre-wrap; word-break: break-word; }
  table.history td.error { color: var(--bad); white-space: pre-wrap; word-break: break-word; font-size: 12px; }
  table.history td.actions { white-space: nowrap; }
  .pill {
    display: inline-block; background: var(--panel-2); border: 1px solid var(--line);
    color: var(--muted); padding: 1px 7px; border-radius: 999px; font-size: 11px;
    font-family: ui-monospace, monospace;
  }

  .logs {
    background: #0a0c11; border: 1px solid var(--line); border-radius: 6px;
    padding: 12px; font: 12px/1.55 ui-monospace, monospace; color: #c8cdd6;
    height: 480px; overflow: auto; white-space: pre;
  }
  .logs .line.info { color: #c8cdd6; }
  .logs .line.warn { color: var(--warn); }
  .logs .line.error { color: var(--bad); }

  .empty {
    color: var(--muted); padding: 36px 16px; text-align: center; font-size: 13px;
  }

  .meta {
    display: flex; gap: 16px; flex-wrap: wrap; color: var(--muted);
    font-size: 12px; font-family: ui-monospace, monospace; margin-top: 12px;
  }
  .meta span strong { color: var(--text); font-weight: 500; }

  .badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 8px; border-radius: 999px; font-size: 11px;
    background: var(--panel-2); border: 1px solid var(--line);
  }
  .badge.good { color: var(--good); border-color: rgba(92,221,139,0.4); }
  .badge.bad  { color: var(--bad);  border-color: rgba(255,122,144,0.4); }

  .record-row {
    display: flex; align-items: center; gap: 14px; padding: 8px 0;
  }
  .record-meta { display: flex; align-items: center; gap: 10px; }
  button.btn.record {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 18px; min-width: 130px; justify-content: center;
    background: linear-gradient(180deg, #e34d65 0%, #c63d52 100%);
    border: 1px solid #d54562; box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset;
    font-weight: 600;
  }
  button.btn.record:hover {
    background: linear-gradient(180deg, #ee5973 0%, #d04458 100%);
  }
  button.btn.record.recording {
    background: linear-gradient(180deg, #3a3f4a 0%, #2c313c 100%);
    border-color: #424857;
  }
  button.btn.record .rec-dot {
    width: 10px; height: 10px; border-radius: 50%; background: #fff;
    box-shadow: 0 0 6px rgba(255,255,255,0.6);
  }
  button.btn.record.recording .rec-dot {
    background: var(--bad); box-shadow: 0 0 0 0 rgba(255,122,144,0.6);
    animation: pulse 1.2s ease-in-out infinite;
  }
  button.btn.record:disabled {
    opacity: 0.55; cursor: progress;
    background: linear-gradient(180deg, #4b5161 0%, #3a3f4a 100%);
    border-color: #424857;
  }
  @keyframes pulse {
    0%   { box-shadow: 0 0 0 0 rgba(255,122,144,0.6); }
    70%  { box-shadow: 0 0 0 10px rgba(255,122,144,0); }
    100% { box-shadow: 0 0 0 0 rgba(255,122,144,0); }
  }

  .record-result { margin-top: 16px; }
  .record-result textarea { font-size: 13px; min-height: 80px; }
</style>
</head>
<body>

<header>
  <div class="dot"></div>
  <h1>Voice Coder</h1>
  <div class="sub" id="status-sub">Configuration & history</div>
</header>

<nav class="tabs" id="tabs">
  <button data-tab="config" class="active">Config</button>
  <button data-tab="apikey">API Key</button>
  <button data-tab="history">History</button>
  <button data-tab="logs">Logs</button>
</nav>

<main>

  <!-- Config -->
  <section data-pane="config">

    <!-- Test recording panel -->
    <div class="panel">
      <h2>Test recording</h2>
      <div class="hint">Record from the browser to test config changes. The transcript appears below and is also copied to your clipboard. Auto-paste is off here (your focus is in this tab, not where you want the text).</div>

      <div class="record-row">
        <button class="btn record" id="record-btn">
          <span class="rec-dot"></span>
          <span id="record-label">Record</span>
        </button>
        <div class="record-meta">
          <span id="record-timer" class="mono">00:00</span>
          <span id="record-status" class="badge" hidden></span>
        </div>
        <div class="spacer"></div>
        <button class="btn secondary" id="record-cancel" hidden>Cancel</button>
      </div>

      <div id="record-result" class="record-result" hidden>
        <label>Last transcript</label>
        <textarea id="record-text" readonly rows="4"></textarea>
        <div class="toolbar" style="margin-top:8px;">
          <span class="meta mono" id="record-result-meta"></span>
          <div class="spacer"></div>
          <button class="btn secondary" id="record-copy">Copy</button>
          <button class="btn secondary" id="record-clear">Clear</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <h2>Model & behavior</h2>
      <div class="hint">Changes are saved on click. The next <span class="mono">voice-coder toggle</span> picks them up — no restart needed.</div>

      <div class="row">
        <div>
          <label for="f-model">Gemini model</label>
          <input id="f-model" type="text" placeholder="gemini-3.1-flash-lite">
        </div>
        <div>
          <label for="f-audioTool">Audio recorder</label>
          <select id="f-audioTool">
            <option value="auto">auto</option>
            <option value="arecord">arecord</option>
            <option value="sox">sox</option>
            <option value="ffmpeg">ffmpeg</option>
          </select>
        </div>
      </div>

      <div class="row three">
        <div>
          <label for="f-sampleRate">Sample rate (Hz)</label>
          <input id="f-sampleRate" type="number" min="8000" max="48000" step="1000">
        </div>
        <div>
          <label for="f-maxRecordingSeconds">Max recording (seconds)</label>
          <input id="f-maxRecordingSeconds" type="number" min="5" max="3600">
        </div>
        <div>
          <label>Other</label>
          <div style="display:flex; gap:10px; align-items:center; padding-top:8px;">
            <label style="display:flex; align-items:center; gap:6px; color:var(--text); margin:0;">
              <input id="f-autoPaste" type="checkbox"> auto-paste
            </label>
            <label style="display:flex; align-items:center; gap:6px; color:var(--text); margin:0;">
              <input id="f-notify" type="checkbox"> notifications
            </label>
          </div>
        </div>
      </div>

      <div class="field">
        <label for="f-systemInstruction">System instruction (the prompt that shapes Gemini's output)</label>
        <textarea id="f-systemInstruction" rows="14"></textarea>
      </div>

      <div class="toolbar">
        <button class="btn" id="save-config">Save</button>
        <button class="btn secondary" id="reload-config">Discard changes</button>
        <div class="spacer"></div>
        <div class="meta">
          <span>config: <span class="mono" id="meta-config-path"></span></span>
          <span>paste: <span class="mono" id="meta-paste-tool"></span></span>
        </div>
      </div>
    </div>
  </section>

  <!-- API key -->
  <section data-pane="apikey" hidden>
    <div class="panel">
      <h2>Gemini API key</h2>
      <div class="hint">Stored at <span class="mono" id="meta-key-path"></span> with mode 0600. Or set <span class="mono">GEMINI_API_KEY</span> env var.</div>

      <div class="field">
        <label>Current key</label>
        <div class="toolbar">
          <input id="f-apikey-masked" type="text" readonly placeholder="(not set)">
          <button class="btn danger" id="clear-key">Clear</button>
        </div>
      </div>

      <div class="field">
        <label for="f-apikey">Set a new key</label>
        <input id="f-apikey" type="password" placeholder="AIza…">
      </div>

      <div class="toolbar">
        <button class="btn" id="save-key">Save key</button>
        <button class="btn secondary" id="test-key">Test connection</button>
        <div class="spacer"></div>
        <span id="test-result" class="badge" hidden></span>
      </div>

      <div class="hint" style="margin-top:14px;">
        Need a key? Get one at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> — free tier is generous.
      </div>
    </div>
  </section>

  <!-- History -->
  <section data-pane="history" hidden>
    <div class="panel">
      <div class="toolbar" style="margin-bottom: 12px;">
        <h2 style="margin: 0;">Transcription history</h2>
        <span id="history-count" class="pill"></span>
        <div class="spacer"></div>
        <button class="btn secondary" id="refresh-history">Refresh</button>
        <button class="btn danger" id="clear-history">Clear all</button>
      </div>
      <div id="history-container"></div>
    </div>
  </section>

  <!-- Logs -->
  <section data-pane="logs" hidden>
    <div class="panel">
      <div class="toolbar" style="margin-bottom: 12px;">
        <h2 style="margin: 0;">Logs</h2>
        <span class="hint" style="margin:0;">tail of voice-coder.log</span>
        <div class="spacer"></div>
        <label style="display:flex; align-items:center; gap:6px; color:var(--text); margin:0;">
          <input id="f-auto-refresh" type="checkbox" checked> auto-refresh
        </label>
        <button class="btn secondary" id="refresh-logs">Refresh</button>
        <button class="btn danger" id="clear-logs">Clear</button>
      </div>
      <div class="logs" id="logs-container"></div>
    </div>
  </section>

</main>

<div class="toast" id="toast"></div>

<script>
(() => {
  // ---------- helpers ----------
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function toast(msg, kind = "") {
    const el = $("#toast");
    el.textContent = msg;
    el.className = "toast show " + kind;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2400);
  }

  async function api(method, path, body, signal) {
    const opts = { method, headers: {}, signal };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(path, opts);
    const text = await r.text();
    const data = text ? JSON.parse(text) : {};
    if (!r.ok) throw new Error(data.error || \`HTTP \${r.status}\`);
    return data;
  }

  function fmt(ts) {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });
  }

  function escape(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"
    }[c]));
  }

  // ---------- tabs ----------
  let currentTab = "config";
  $$("#tabs button").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  function switchTab(name) {
    currentTab = name;
    $$("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    $$("[data-pane]").forEach((p) => p.hidden = (p.dataset.pane !== name));
    if (name === "history") loadHistory();
    if (name === "logs") loadLogs();
  }

  // ---------- config ----------
  let lastConfig = null;
  async function loadConfig() {
    const data = await api("GET", "/api/config");
    lastConfig = data.config;
    $("#f-model").value = data.config.model;
    $("#f-audioTool").value = data.config.audioTool;
    $("#f-sampleRate").value = data.config.sampleRate;
    $("#f-maxRecordingSeconds").value = data.config.maxRecordingSeconds;
    $("#f-autoPaste").checked = data.config.autoPaste;
    $("#f-notify").checked = data.config.notify;
    $("#f-systemInstruction").value = data.config.systemInstruction;
    $("#meta-config-path").textContent = data.paths.configFile;
    $("#meta-key-path").textContent = data.paths.apiKeyFile;
    $("#meta-paste-tool").textContent = data.pasteTool;
  }

  $("#save-config").addEventListener("click", async () => {
    const body = {
      model: $("#f-model").value.trim(),
      audioTool: $("#f-audioTool").value,
      sampleRate: parseInt($("#f-sampleRate").value, 10),
      maxRecordingSeconds: parseInt($("#f-maxRecordingSeconds").value, 10),
      autoPaste: $("#f-autoPaste").checked,
      notify: $("#f-notify").checked,
      systemInstruction: $("#f-systemInstruction").value,
    };
    try {
      await api("PUT", "/api/config", body);
      toast("Saved.", "ok");
      loadConfig();
    } catch (err) {
      toast("Save failed: " + err.message, "bad");
    }
  });

  $("#reload-config").addEventListener("click", () => {
    if (lastConfig) {
      $("#f-model").value = lastConfig.model;
      $("#f-audioTool").value = lastConfig.audioTool;
      $("#f-sampleRate").value = lastConfig.sampleRate;
      $("#f-maxRecordingSeconds").value = lastConfig.maxRecordingSeconds;
      $("#f-autoPaste").checked = lastConfig.autoPaste;
      $("#f-notify").checked = lastConfig.notify;
      $("#f-systemInstruction").value = lastConfig.systemInstruction;
      toast("Reverted to saved values.");
    }
  });

  // ---------- api key ----------
  async function loadApiKey() {
    const data = await api("GET", "/api/api-key");
    $("#f-apikey-masked").value = data.set ? data.masked : "";
    $("#f-apikey-masked").placeholder = data.set ? "" : "(not set)";
  }

  $("#save-key").addEventListener("click", async () => {
    const k = $("#f-apikey").value;
    if (!k.trim()) return toast("Paste a key first.", "bad");
    try {
      await api("PUT", "/api/api-key", { key: k });
      $("#f-apikey").value = "";
      toast("API key saved.", "ok");
      loadApiKey();
    } catch (err) {
      toast(err.message, "bad");
    }
  });

  $("#clear-key").addEventListener("click", async () => {
    if (!confirm("Clear the saved API key?")) return;
    await api("DELETE", "/api/api-key");
    toast("Cleared.", "ok");
    loadApiKey();
  });

  $("#test-key").addEventListener("click", async () => {
    const el = $("#test-result");
    el.hidden = false;
    el.className = "badge";
    el.textContent = "Testing…";
    try {
      const r = await api("POST", "/api/test-connection");
      if (r.ok) {
        el.className = "badge good";
        el.textContent = \`✓ OK · \${r.model} · \${r.latencyMs}ms\`;
      } else {
        el.className = "badge bad";
        el.textContent = "✗ " + (r.error || "failed");
      }
    } catch (err) {
      el.className = "badge bad";
      el.textContent = "✗ " + err.message;
    }
  });

  // ---------- history ----------
  async function loadHistory() {
    const data = await api("GET", "/api/history");
    const c = $("#history-container");
    $("#history-count").textContent = data.entries.length + " entries";
    if (data.entries.length === 0) {
      c.innerHTML = '<div class="empty">No transcriptions yet. Press your Voice Coder shortcut to record.</div>';
      return;
    }
    const rows = data.entries.map((e, i) => {
      const cell = e.error
        ? \`<td class="error">⚠ \${escape(e.error)}</td>\`
        : \`<td class="text">\${escape(e.text)}</td>\`;
      return \`<tr>
        <td class="ts">\${fmt(e.ts)}</td>
        <td class="model">\${escape(e.model || "")}</td>
        \${cell}
        <td class="meta mono"><span class="pill">\${e.durationMs}ms</span> <span class="pill">\${Math.round((e.audioBytes||0)/1024)}kB</span></td>
        <td class="actions">\${e.error ? "" : \`<button class="btn secondary" data-copy="\${i}">Copy</button>\`}</td>
      </tr>\`;
    }).join("");
    c.innerHTML = \`<table class="history">
      <thead><tr><th>When</th><th>Model</th><th>Transcript</th><th></th><th></th></tr></thead>
      <tbody>\${rows}</tbody>
    </table>\`;
    c.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const i = +btn.dataset.copy;
        await navigator.clipboard.writeText(data.entries[i].text);
        toast("Copied to clipboard.", "ok");
      });
    });
  }

  $("#refresh-history").addEventListener("click", loadHistory);
  $("#clear-history").addEventListener("click", async () => {
    if (!confirm("Delete all history entries?")) return;
    await api("DELETE", "/api/history");
    toast("History cleared.", "ok");
    loadHistory();
  });

  // ---------- logs ----------
  let logsTimer = null;
  async function loadLogs() {
    const data = await api("GET", "/api/logs");
    const c = $("#logs-container");
    if (data.lines.length === 0) {
      c.innerHTML = '<div style="color: var(--muted)">(no log entries yet)</div>';
    } else {
      c.innerHTML = data.lines.map((line) => {
        const cls = line.includes("[error]") ? "error" : line.includes("[warn]") ? "warn" : "info";
        return \`<div class="line \${cls}">\${escape(line)}</div>\`;
      }).join("");
      c.scrollTop = c.scrollHeight;
    }
  }
  $("#refresh-logs").addEventListener("click", loadLogs);
  $("#clear-logs").addEventListener("click", async () => {
    if (!confirm("Clear log file?")) return;
    await api("DELETE", "/api/logs");
    toast("Logs cleared.", "ok");
    loadLogs();
  });

  function setLogsAutoRefresh(on) {
    if (logsTimer) { clearInterval(logsTimer); logsTimer = null; }
    if (on) logsTimer = setInterval(() => { if (currentTab === "logs") loadLogs(); }, 2000);
  }
  $("#f-auto-refresh").addEventListener("change", (e) => setLogsAutoRefresh(e.target.checked));
  setLogsAutoRefresh(true);

  // ---------- record (test from UI) ----------
  let recordState = "idle";      // 'idle' | 'recording' | 'transcribing'
  let recordStartedAt = 0;
  let recordTimer = null;
  let recordStatusPoll = null;

  function fmtElapsed(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  function setRecordUi(state, opts = {}) {
    recordState = state;
    const btn = $("#record-btn");
    const lbl = $("#record-label");
    const cancel = $("#record-cancel");
    const status = $("#record-status");

    btn.classList.toggle("recording", state === "recording");
    btn.disabled = (state === "transcribing");

    if (state === "idle") {
      lbl.textContent = "Record";
      cancel.hidden = true;
      status.hidden = true;
      $("#record-timer").textContent = "00:00";
    } else if (state === "recording") {
      lbl.textContent = "Stop";
      cancel.hidden = false;
      status.hidden = true;
    } else if (state === "transcribing") {
      lbl.textContent = "Transcribing…";
      // Cancel is still useful here — aborts the Gemini fetch so the user
      // isn't stuck if the model is slow or the network drops
      cancel.hidden = false;
      status.hidden = false;
      status.className = "badge";
      status.textContent = opts.label || "calling Gemini…";
    }
  }

  function startTimer() {
    if (recordTimer) clearInterval(recordTimer);
    recordTimer = setInterval(() => {
      $("#record-timer").textContent = fmtElapsed(Date.now() - recordStartedAt);
    }, 250);
  }
  function stopTimer() {
    if (recordTimer) { clearInterval(recordTimer); recordTimer = null; }
  }

  async function refreshRecordStatus() {
    try {
      const s = await api("GET", "/api/record/status");
      if (s.state === "recording" && recordState !== "recording") {
        recordStartedAt = s.startedAt;
        setRecordUi("recording");
        startTimer();
      } else if (s.state === "idle" && recordState === "recording") {
        // External cancel (e.g. via keyboard shortcut)
        setRecordUi("idle");
        stopTimer();
      }
    } catch { /* server gone, ignore */ }
  }

  function startStatusPoll() {
    if (recordStatusPoll) clearInterval(recordStatusPoll);
    // Light poll so UI reflects state changes caused by the keyboard shortcut
    recordStatusPoll = setInterval(refreshRecordStatus, 1500);
  }

  let recordBusy = false;          // true between click and response — prevents double-fire
  let stopAbort = null;            // AbortController for the in-flight stop request

  async function recordToggle() {
    if (recordBusy) return;
    if (recordState === "transcribing") return;
    recordBusy = true;
    $("#record-btn").disabled = true;   // hard lock until response

    try {
      if (recordState === "idle") {
        const s = await api("POST", "/api/record/start");
        recordStartedAt = s.startedAt || Date.now();
        setRecordUi("recording");
        startTimer();
      } else if (recordState === "recording") {
        stopTimer();
        setRecordUi("transcribing");
        stopAbort = new AbortController();
        const r = await api("POST", "/api/record/stop", { paste: false }, stopAbort.signal);
        showResult(r);
        setRecordUi("idle");
        if (currentTab === "history") loadHistory();
      }
    } catch (err) {
      // AbortError fires when the user clicks Cancel
      if (err.name === "AbortError") {
        toast("Cancelled.", "");
      } else {
        toast(err.message, "bad");
      }
      setRecordUi("idle");
    } finally {
      stopAbort = null;
      recordBusy = false;
      // Button re-enables inside setRecordUi() based on state
      if (recordState !== "transcribing") $("#record-btn").disabled = false;
    }
  }

  function showResult(r) {
    $("#record-result").hidden = false;
    $("#record-text").value = r.text || "";
    $("#record-result-meta").textContent =
      \`\${r.durationMs}ms · \${Math.round((r.audioBytes||0)/1024)} kB · paste=\${r.paste}\`;
    toast("Transcribed — copied to clipboard.", "ok");
  }

  $("#record-btn").addEventListener("click", recordToggle);
  $("#record-cancel").addEventListener("click", async () => {
    // If we're waiting on the transcribe response, abort it client-side
    if (stopAbort) {
      stopAbort.abort();
      stopAbort = null;
      return; // recordToggle()'s catch will toast and reset UI
    }
    // Otherwise we're recording — tell the server to discard
    try {
      await api("POST", "/api/record/cancel");
    } catch (err) {
      toast(err.message, "bad");
    }
    stopTimer();
    setRecordUi("idle");
  });
  $("#record-copy").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("#record-text").value);
    toast("Copied.", "ok");
  });
  $("#record-clear").addEventListener("click", () => {
    $("#record-result").hidden = true;
    $("#record-text").value = "";
  });

  // ---------- boot ----------
  Promise.all([loadConfig(), loadApiKey(), refreshRecordStatus()]).catch((err) => toast(err.message, "bad"));
  startStatusPoll();
})();
</script>

</body>
</html>`;
