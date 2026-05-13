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
  /* --- design tokens ----------------------------------------------------- */
  :root {
    --bg: #0a0c11;
    --surface: #11141b;
    --surface-2: #181c25;
    --surface-3: #1f2430;
    --line: #232938;
    --line-2: #2c3344;
    --text: #e7e9ee;
    --text-dim: #9aa1b1;
    --text-mute: #6c7385;
    --accent: #7aa7ff;
    --accent-2: #5482e8;
    --good: #5cdd8b;
    --bad: #ff7a90;
    --warn: #ffb454;

    --r-sm: 6px;
    --r-md: 10px;
    --r-lg: 14px;

    --s-1: 4px;
    --s-2: 8px;
    --s-3: 12px;
    --s-4: 16px;
    --s-5: 24px;
    --s-6: 32px;
    --s-7: 48px;

    --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.35);
  }

  /* --- base -------------------------------------------------------------- */
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; background: var(--bg); color: var(--text);
    font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  code, pre, .mono { font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }

  /* --- layout: sidebar + main -------------------------------------------- */
  .shell { display: grid; grid-template-columns: 232px 1fr; min-height: 100vh; }

  .sidebar {
    background: var(--surface);
    border-right: 1px solid var(--line);
    padding: var(--s-5) var(--s-3);
    display: flex; flex-direction: column; gap: var(--s-2);
    position: sticky; top: 0; height: 100vh;
  }
  .sidebar .brand {
    display: flex; align-items: center; gap: var(--s-3);
    padding: var(--s-2) var(--s-3); margin-bottom: var(--s-5);
  }
  .sidebar .brand .logo {
    width: 28px; height: 28px; border-radius: 8px;
    background: linear-gradient(135deg, var(--accent) 0%, #4e80e6 100%);
    display: grid; place-items: center; color: #0a0c11; font-weight: 700; font-size: 13px;
    box-shadow: 0 0 16px rgba(122,167,255,0.3);
  }
  .sidebar .brand .name { font-size: 15px; font-weight: 600; letter-spacing: 0.2px; }
  .sidebar .brand .ver { font-size: 11px; color: var(--text-mute); margin-left: auto; font-family: ui-monospace, monospace; }

  .nav { display: flex; flex-direction: column; gap: 2px; }
  .nav button {
    background: transparent; border: 0; color: var(--text-dim); cursor: pointer;
    padding: 10px var(--s-3); font: inherit; text-align: left;
    border-radius: var(--r-sm); transition: background 120ms ease, color 120ms ease;
    display: flex; align-items: center; gap: var(--s-3);
  }
  .nav button:hover { background: var(--surface-2); color: var(--text); }
  .nav button.active { background: var(--surface-2); color: var(--text); }
  .nav button .icon { width: 16px; display: inline-flex; justify-content: center; opacity: 0.9; }
  .nav button .badge-active {
    margin-left: auto; width: 6px; height: 6px; border-radius: 50%;
    background: var(--accent); box-shadow: 0 0 8px var(--accent);
  }

  .sidebar .foot {
    margin-top: auto; padding: var(--s-3); color: var(--text-mute); font-size: 11px;
    border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 4px;
  }
  .sidebar .foot .active-profile {
    display: flex; align-items: center; gap: var(--s-2); color: var(--text-dim);
  }
  .sidebar .foot .swatch { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }

  /* --- main content ----------------------------------------------------- */
  main { padding: var(--s-6) var(--s-7); max-width: 1080px; width: 100%; }
  .page-head { margin-bottom: var(--s-5); display: flex; align-items: baseline; gap: var(--s-3); }
  .page-head h1 { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.3px; }
  .page-head .sub { color: var(--text-mute); font-size: 13px; }

  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: var(--s-5);
    margin-bottom: var(--s-4);
  }
  .card h2 { margin: 0 0 var(--s-1); font-size: 14px; font-weight: 600; letter-spacing: 0.1px; }
  .card .help { color: var(--text-mute); font-size: 12px; margin-bottom: var(--s-4); }

  /* --- form controls ---------------------------------------------------- */
  label { display: block; font-size: 11px; color: var(--text-mute); margin-bottom: 6px;
          font-weight: 500; letter-spacing: 0.4px; text-transform: uppercase; }
  input[type=text], input[type=password], input[type=number], select, textarea {
    width: 100%; background: var(--surface-2); color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm);
    padding: 9px 11px; font: inherit;
    transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
  }
  input:focus, select:focus, textarea:focus {
    outline: none; border-color: var(--accent-2); background: var(--surface-3);
    box-shadow: 0 0 0 3px rgba(78,128,230,0.18);
  }
  textarea { resize: vertical; min-height: 160px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 13px; line-height: 1.6; }
  .field { margin-bottom: var(--s-4); }
  .row { display: grid; gap: var(--s-4); grid-template-columns: 1fr 1fr; }
  .row.three { grid-template-columns: 1fr 1fr 1fr; }
  .check { display: inline-flex; align-items: center; gap: var(--s-2); color: var(--text); cursor: pointer; }
  .check input { width: auto; }

  /* --- buttons ---------------------------------------------------------- */
  button.btn {
    background: var(--accent-2); color: #fff; border: 0; border-radius: var(--r-sm);
    padding: 9px 14px; font: inherit; font-weight: 500; cursor: pointer;
    transition: background 120ms ease, transform 60ms ease, box-shadow 120ms ease;
  }
  button.btn:hover { background: #6a98ee; }
  button.btn:active { transform: scale(0.98); }
  button.btn.secondary { background: var(--surface-2); border: 1px solid var(--line); color: var(--text); }
  button.btn.secondary:hover { background: var(--surface-3); }
  button.btn.danger { background: transparent; border: 1px solid rgba(255,122,144,0.5); color: var(--bad); }
  button.btn.danger:hover { background: rgba(255,122,144,0.12); }
  button.btn.ghost { background: transparent; color: var(--text-dim); }
  button.btn.ghost:hover { color: var(--text); }
  button.btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

  .toolbar { display: flex; gap: var(--s-2); align-items: center; flex-wrap: wrap; }
  .spacer { flex: 1; }

  /* --- toast ------------------------------------------------------------ */
  .toast {
    position: fixed; bottom: 24px; right: 24px;
    background: var(--surface-2); border: 1px solid var(--line);
    padding: 10px 14px; border-radius: var(--r-sm); font-size: 13px;
    opacity: 0; pointer-events: none; transform: translateY(8px);
    transition: opacity 150ms ease, transform 150ms ease;
    max-width: 360px; box-shadow: var(--shadow-md);
  }
  .toast.show { opacity: 1; transform: translateY(0); }
  .toast.ok { border-color: rgba(92,221,139,0.5); }
  .toast.bad { border-color: rgba(255,122,144,0.5); }

  /* --- home: tiles ------------------------------------------------------ */
  .tile-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--s-4);
  }
  .tile {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: var(--s-5);
    cursor: pointer;
    position: relative; overflow: hidden;
    transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
    display: flex; flex-direction: column; gap: var(--s-2);
    min-height: 168px;
  }
  .tile::before {
    content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: var(--tile-color, var(--accent));
    opacity: 0.85;
  }
  .tile:hover { background: var(--surface-2); border-color: var(--line-2); }
  .tile.selected { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(122,167,255,0.18); }
  .tile.active { background: linear-gradient(180deg, rgba(122,167,255,0.06) 0%, transparent 60%); }
  .tile .num {
    position: absolute; top: var(--s-3); right: var(--s-3);
    width: 22px; height: 22px; border-radius: 6px;
    background: var(--surface-3); color: var(--text-mute); font-size: 11px;
    font-family: ui-monospace, monospace; display: grid; place-items: center;
  }
  .tile .name { font-size: 16px; font-weight: 600; margin-top: var(--s-2); }
  .tile .model { font-size: 11px; color: var(--text-mute); font-family: ui-monospace, monospace; }
  .tile .preview {
    color: var(--text-mute); font-size: 12px; line-height: 1.55;
    overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
    margin-top: var(--s-2);
  }
  .tile .footer {
    margin-top: auto; padding-top: var(--s-3);
    border-top: 1px solid var(--line);
    display: flex; align-items: center; gap: var(--s-2); font-size: 11px;
  }
  .tile.active .badge-on { color: var(--good); }
  .tile.add {
    border: 1px dashed var(--line-2); background: transparent;
    color: var(--text-mute); display: grid; place-items: center;
    text-align: center; min-height: 168px;
  }
  .tile.add:hover { background: var(--surface); border-color: var(--accent-2); color: var(--text); }
  .tile.add .plus { font-size: 28px; line-height: 1; font-weight: 200; }
  .tile.add .label { font-size: 12px; margin-top: var(--s-1); }

  .kbd-hints { color: var(--text-mute); font-size: 12px; margin-top: var(--s-4); display: flex; gap: var(--s-4); flex-wrap: wrap; }
  .kbd-hints kbd {
    background: var(--surface-2); border: 1px solid var(--line); border-bottom-width: 2px;
    padding: 1px 6px; border-radius: 4px; font-size: 11px;
    font-family: ui-monospace, monospace; color: var(--text-dim);
  }

  /* --- record panel ---------------------------------------------------- */
  .record-row {
    display: flex; align-items: center; gap: var(--s-4); padding: var(--s-2) 0;
  }
  .record-meta { display: flex; align-items: center; gap: 10px; }
  button.btn.record {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 11px 22px; min-width: 140px; justify-content: center;
    background: linear-gradient(180deg, #e34d65 0%, #c63d52 100%);
    border: 1px solid #c63d52; font-weight: 600; font-size: 14px;
    box-shadow: var(--shadow-sm);
  }
  button.btn.record:hover { background: linear-gradient(180deg, #ee5973 0%, #d04458 100%); }
  button.btn.record.recording {
    background: linear-gradient(180deg, var(--surface-3) 0%, var(--surface-2) 100%);
    border-color: var(--line-2);
  }
  button.btn.record .rec-dot {
    width: 10px; height: 10px; border-radius: 50%; background: #fff;
  }
  button.btn.record.recording .rec-dot { background: var(--bad); animation: pulse 1.2s ease-in-out infinite; }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }

  /* --- history table --------------------------------------------------- */
  table.history { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.history th, table.history td {
    text-align: left; padding: 12px 8px; border-bottom: 1px solid var(--line);
    vertical-align: top;
  }
  table.history th { color: var(--text-mute); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  table.history td.ts { color: var(--text-mute); white-space: nowrap; font-family: ui-monospace, monospace; font-size: 12px; }
  table.history td.profile { white-space: nowrap; font-size: 12px; }
  table.history td.text { white-space: pre-wrap; word-break: break-word; line-height: 1.55; }
  table.history td.error { color: var(--bad); white-space: pre-wrap; word-break: break-word; font-size: 12px; }
  table.history td.actions { white-space: nowrap; }
  .pill {
    display: inline-block; background: var(--surface-2); border: 1px solid var(--line);
    color: var(--text-dim); padding: 1px 8px; border-radius: 999px; font-size: 11px;
    font-family: ui-monospace, monospace;
  }
  .pill.profile-pill { display: inline-flex; align-items: center; gap: 6px; }
  .pill.profile-pill .dot { width: 6px; height: 6px; border-radius: 50%; }

  /* --- logs ------------------------------------------------------------ */
  .logs {
    background: #07090d; border: 1px solid var(--line); border-radius: var(--r-sm);
    padding: var(--s-3); font: 12px/1.6 "JetBrains Mono", ui-monospace, monospace; color: #c8cdd6;
    height: 520px; overflow: auto; white-space: pre;
  }
  .logs .line.warn { color: var(--warn); }
  .logs .line.error { color: var(--bad); }

  .empty { color: var(--text-mute); padding: 48px 16px; text-align: center; font-size: 13px; }

  .badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 10px; border-radius: 999px; font-size: 11px;
    background: var(--surface-2); border: 1px solid var(--line);
  }
  .badge.good { color: var(--good); border-color: rgba(92,221,139,0.4); }
  .badge.bad  { color: var(--bad);  border-color: rgba(255,122,144,0.4); }

  .meta { color: var(--text-mute); font-size: 12px; font-family: ui-monospace, monospace; }

  /* --- modal ---------------------------------------------------------- */
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(5,7,11,0.6); display: grid; place-items: center; z-index: 50;
    backdrop-filter: blur(4px);
  }
  /* Without this, our display: grid above clobbers the [hidden] attribute and
     the modal would render on page load. */
  .modal-backdrop[hidden] { display: none !important; }
  .modal {
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md);
    padding: var(--s-5); width: 420px; max-width: 92vw; box-shadow: var(--shadow-md);
  }
  .modal h3 { margin: 0 0 var(--s-3); font-size: 15px; font-weight: 600; }

  /* Color picker — works in modals AND the Config tab. <span> defaults to
     display: inline which ignores width/height, so explicit display matters. */
  .swatches { display: flex; flex-wrap: wrap; gap: var(--s-2); margin-top: var(--s-2); }
  .swatch {
    display: inline-block;
    width: 26px; height: 26px; border-radius: 7px; cursor: pointer;
    border: 2px solid transparent; transition: transform 80ms ease, border-color 80ms ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }
  .swatch:hover { transform: scale(1.08); }
  .swatch.selected { border-color: #fff; transform: scale(1.05); }
  /* Smaller variant for the sidebar footer */
  .sidebar .foot .swatch {
    width: 8px; height: 8px; border-radius: 50%; box-shadow: none; border-width: 0;
  }
</style>
</head>
<body>

<div class="shell">

  <!-- ============ SIDEBAR ============ -->
  <aside class="sidebar">
    <div class="brand">
      <div class="logo">V</div>
      <div class="name">Voice Coder</div>
      <div class="ver" id="brand-ver"></div>
    </div>

    <nav class="nav" id="nav">
      <button data-tab="home" class="active">
        <span class="icon">⌂</span><span>Home</span>
      </button>
      <button data-tab="config">
        <span class="icon">⚙</span><span>Profile config</span>
      </button>
      <button data-tab="apikey">
        <span class="icon">⌬</span><span>API Key</span>
      </button>
      <button data-tab="history">
        <span class="icon">↻</span><span>History</span>
      </button>
      <button data-tab="logs">
        <span class="icon">≡</span><span>Logs</span>
      </button>
    </nav>

    <div class="foot">
      <div class="active-profile">
        <span class="swatch" id="foot-swatch"></span>
        <span id="foot-active-name">—</span>
      </div>
      <div id="foot-paste">paste: detecting…</div>
    </div>
  </aside>

  <!-- ============ MAIN ============ -->
  <main>

    <!-- =========== HOME =========== -->
    <section data-pane="home">
      <div class="page-head">
        <h1>Profiles</h1>
        <div class="sub">Pick a profile · the next recording uses it</div>
      </div>

      <div class="tile-grid" id="tile-grid"></div>

      <div class="kbd-hints">
        <span><kbd>1</kbd>–<kbd>9</kbd> jump &amp; activate</span>
        <span><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> select</span>
        <span><kbd>Enter</kbd> activate</span>
        <span><kbd>E</kbd> edit</span>
        <span><kbd>N</kbd> new</span>
        <span><kbd>D</kbd> delete</span>
      </div>
    </section>

    <!-- =========== CONFIG =========== -->
    <section data-pane="config" hidden>
      <div class="page-head">
        <h1>Profile config</h1>
        <div class="sub" id="config-sub">Editing: <span id="config-target">—</span></div>
      </div>

      <!-- Record panel for testing -->
      <div class="card">
        <h2>Test recording</h2>
        <div class="help">Record from the browser to test changes. Auto-paste is off here. The transcript appears below and is also copied to your clipboard.</div>

        <div class="record-row">
          <button class="btn record" id="record-btn">
            <span class="rec-dot"></span><span id="record-label">Record</span>
          </button>
          <div class="record-meta">
            <span id="record-timer" class="mono">00:00</span>
            <span id="record-status" class="badge" hidden></span>
          </div>
          <div class="spacer"></div>
          <button class="btn secondary" id="record-cancel" hidden>Cancel</button>
        </div>

        <div id="record-result" style="margin-top: var(--s-4);" hidden>
          <label>Last transcript</label>
          <textarea id="record-text" readonly rows="4"></textarea>
          <div class="toolbar" style="margin-top: var(--s-2);">
            <span class="meta" id="record-result-meta"></span>
            <div class="spacer"></div>
            <button class="btn secondary" id="record-copy">Copy</button>
            <button class="btn ghost" id="record-clear">Clear</button>
          </div>
        </div>
      </div>

      <!-- Profile identity -->
      <div class="card">
        <h2>Identity</h2>
        <div class="row">
          <div>
            <label>Name</label>
            <input id="f-name" type="text">
          </div>
          <div>
            <label>Color</label>
            <div class="swatches" id="color-swatches"></div>
          </div>
        </div>
      </div>

      <!-- Model & behavior -->
      <div class="card">
        <h2>Model &amp; behavior</h2>
        <div class="help">Saved on click. The next recording with this profile picks them up — no restart needed.</div>

        <div class="row">
          <div>
            <label>Gemini model</label>
            <input id="f-model" type="text" placeholder="gemini-3.1-flash-lite">
          </div>
          <div>
            <label>Audio recorder</label>
            <select id="f-audioTool">
              <option value="auto">auto</option>
              <option value="arecord">arecord</option>
              <option value="sox">sox</option>
              <option value="ffmpeg">ffmpeg</option>
            </select>
          </div>
        </div>

        <div class="row three" style="margin-top: var(--s-4);">
          <div>
            <label>Sample rate (Hz)</label>
            <input id="f-sampleRate" type="number" min="8000" max="48000" step="1000">
          </div>
          <div>
            <label>Max recording (s)</label>
            <input id="f-maxRecordingSeconds" type="number" min="5" max="3600">
          </div>
          <div>
            <label>Toggles</label>
            <div style="display:flex; gap: var(--s-4); padding-top: 6px;">
              <label class="check"><input id="f-autoPaste" type="checkbox"> auto-paste</label>
              <label class="check"><input id="f-notify" type="checkbox"> notify</label>
            </div>
          </div>
        </div>

        <div class="field" style="margin-top: var(--s-4);">
          <label>System instruction</label>
          <textarea id="f-systemInstruction" rows="14" placeholder="You are a transcription engine…"></textarea>
        </div>

        <div class="toolbar">
          <button class="btn" id="save-config">Save changes</button>
          <button class="btn ghost" id="reload-config">Discard</button>
          <div class="spacer"></div>
          <button class="btn danger" id="delete-profile">Delete profile</button>
        </div>
      </div>
    </section>

    <!-- =========== API KEY =========== -->
    <section data-pane="apikey" hidden>
      <div class="page-head">
        <h1>API key</h1>
        <div class="sub">Stored at <span class="mono" id="meta-key-path"></span>, chmod 600. Or set <span class="mono">GEMINI_API_KEY</span>.</div>
      </div>

      <div class="card">
        <div class="field">
          <label>Current key</label>
          <div class="toolbar">
            <input id="f-apikey-masked" type="text" readonly placeholder="(not set)">
            <button class="btn danger" id="clear-key">Clear</button>
          </div>
        </div>
        <div class="field">
          <label>Set a new key</label>
          <input id="f-apikey" type="password" placeholder="AIza…">
        </div>
        <div class="toolbar">
          <button class="btn" id="save-key">Save</button>
          <button class="btn secondary" id="test-key">Test connection</button>
          <div class="spacer"></div>
          <span id="test-result" class="badge" hidden></span>
        </div>
        <div class="help" style="margin-top: var(--s-4);">
          Need a key? Get one free at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>.
        </div>
      </div>
    </section>

    <!-- =========== HISTORY =========== -->
    <section data-pane="history" hidden>
      <div class="page-head">
        <h1>History</h1>
        <div class="sub"><span id="history-count">0</span> transcriptions</div>
        <div class="spacer"></div>
        <button class="btn secondary" id="refresh-history">Refresh</button>
        <button class="btn danger" id="clear-history">Clear</button>
      </div>
      <div class="card">
        <div id="history-container"></div>
      </div>
    </section>

    <!-- =========== LOGS =========== -->
    <section data-pane="logs" hidden>
      <div class="page-head">
        <h1>Logs</h1>
        <div class="sub">tail of voice-coder.log · auto-refreshes every 2s</div>
        <div class="spacer"></div>
        <label class="check"><input id="f-auto-refresh" type="checkbox" checked> auto-refresh</label>
        <button class="btn secondary" id="refresh-logs">Refresh</button>
        <button class="btn danger" id="clear-logs">Clear</button>
      </div>
      <div class="card">
        <div class="logs" id="logs-container"></div>
      </div>
    </section>

  </main>
</div>

<div class="toast" id="toast"></div>

<!-- =========== MODALS =========== -->
<div class="modal-backdrop" id="modal-new" hidden>
  <div class="modal">
    <h3>New profile</h3>
    <div class="field">
      <label>Name</label>
      <input id="new-name" type="text" placeholder="e.g. Malayalam → English (technical)">
    </div>
    <div class="field">
      <label>Color</label>
      <div class="swatches" id="new-swatches"></div>
    </div>
    <div class="toolbar">
      <button class="btn" id="new-create">Create</button>
      <button class="btn ghost" id="new-cancel">Cancel</button>
    </div>
    <div class="help" style="margin-top: var(--s-3);">Inherits model + system instruction from the currently active profile. You can edit them after.</div>
  </div>
</div>

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
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
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

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"
    }[c]));
  }

  // ---------- state ----------
  let profiles = [];        // current list
  let activeId = null;
  let selectedId = null;    // tile selection (independent of active)
  let editingId = null;     // profile currently being edited in Config tab
  let currentTab = "home";

  const PALETTE = [
    "#7aa7ff","#5cdd8b","#ffb454","#ff7a90",
    "#b48cff","#5ed4e0","#ffd166","#ff9d6f"
  ];

  // ---------- tabs ----------
  $$("#nav button").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  function switchTab(name) {
    currentTab = name;
    $$("#nav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    $$("[data-pane]").forEach((p) => p.hidden = (p.dataset.pane !== name));
    if (name === "home")    renderTiles();
    if (name === "config")  renderConfigForm();
    if (name === "history") loadHistory();
    if (name === "logs")    loadLogs();
  }

  // ---------- profiles ----------
  async function loadProfiles() {
    const data = await api("GET", "/api/profiles");
    profiles = data.profiles;
    activeId = data.activeId;
    if (!selectedId || !profiles.find((p) => p.id === selectedId)) selectedId = activeId;
    if (!editingId || !profiles.find((p) => p.id === editingId))   editingId = activeId;
    renderFooter();
    if (currentTab === "home") renderTiles();
    if (currentTab === "config") renderConfigForm();
  }

  function renderFooter() {
    const active = profiles.find((p) => p.id === activeId);
    if (!active) return;
    $("#foot-active-name").textContent = active.name;
    $("#foot-swatch").style.background = active.color;
  }

  function renderTiles() {
    const grid = $("#tile-grid");
    const tiles = profiles.map((p, i) => {
      const preview = (p.systemInstruction || "").trim().slice(0, 160).replace(/\\s+/g, " ");
      const isActive = p.id === activeId;
      const isSelected = p.id === selectedId;
      return \`<div class="tile \${isActive ? "active" : ""} \${isSelected ? "selected" : ""}"
                style="--tile-color: \${p.color}" data-id="\${p.id}" data-i="\${i}" tabindex="0">
        <span class="num">\${i + 1}</span>
        <div class="name">\${esc(p.name)}</div>
        <div class="model">\${esc(p.model)}</div>
        <div class="preview">\${esc(preview)}</div>
        <div class="footer">
          \${isActive ? '<span class="badge-on">● active</span>' : '<span class="meta">tap to activate</span>'}
        </div>
      </div>\`;
    }).join("");

    const addTile = \`<div class="tile add" id="tile-add">
      <div>
        <div class="plus">+</div>
        <div class="label">New profile</div>
      </div>
    </div>\`;

    grid.innerHTML = tiles + addTile;

    grid.querySelectorAll(".tile[data-id]").forEach((el) => {
      const id = el.dataset.id;
      el.addEventListener("click", () => activateProfile(id));
    });
    $("#tile-add").addEventListener("click", openNewModal);
  }

  async function activateProfile(id) {
    try {
      await api("POST", \`/api/profiles/\${id}/activate\`);
      selectedId = id;
      const p = profiles.find((x) => x.id === id);
      toast(\`Activated: \${p?.name ?? id}\`, "ok");
      await loadProfiles();
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  async function deleteProfile(id) {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    if (!confirm(\`Delete profile "\${p.name}"?\`)) return;
    try {
      await api("DELETE", \`/api/profiles/\${id}\`);
      toast("Deleted.", "ok");
      if (selectedId === id) selectedId = null;
      if (editingId === id)   editingId = null;
      await loadProfiles();
    } catch (err) {
      toast(err.message, "bad");
    }
  }

  // ---- new-profile modal
  function renderNewSwatches() {
    const used = new Set(profiles.map((p) => p.color));
    const c = PALETTE.find((x) => !used.has(x)) || PALETTE[0];
    $("#new-swatches").innerHTML = PALETTE.map((color) => (
      \`<span class="swatch \${color === c ? "selected" : ""}"
             style="background: \${color}" data-color="\${color}"></span>\`
    )).join("");
    $("#new-swatches").querySelectorAll(".swatch").forEach((el) => {
      el.addEventListener("click", () => {
        $("#new-swatches").querySelectorAll(".swatch").forEach((s) => s.classList.remove("selected"));
        el.classList.add("selected");
      });
    });
  }
  function openNewModal() {
    $("#new-name").value = "";
    renderNewSwatches();
    $("#modal-new").hidden = false;
    setTimeout(() => $("#new-name").focus(), 30);
  }
  function closeNewModal() { $("#modal-new").hidden = true; }
  $("#new-cancel").addEventListener("click", closeNewModal);
  $("#modal-new").addEventListener("click", (e) => { if (e.target.id === "modal-new") closeNewModal(); });
  let creatingProfile = false;
  $("#new-create").addEventListener("click", async () => {
    if (creatingProfile) return;     // hard-lock against rapid double-click
    const name = $("#new-name").value.trim();
    if (!name) { toast("Pick a name.", "bad"); return; }
    const selectedSwatch = $("#new-swatches .swatch.selected");
    const color = selectedSwatch ? selectedSwatch.dataset.color : PALETTE[0];

    creatingProfile = true;
    const btn = $("#new-create");
    const origLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Creating…";

    try {
      const p = await api("POST", "/api/profiles", { name, color });
      toast(\`Created: \${p.name}\`, "ok");
      selectedId = p.id;
      editingId = p.id;
      await loadProfiles();
      switchTab("config");
    } catch (err) {
      toast(err.message, "bad");
    } finally {
      // Always close the modal so the user isn't stuck, even if something
      // downstream threw after the profile was actually saved on disk.
      closeNewModal();
      creatingProfile = false;
      btn.disabled = false;
      btn.textContent = origLabel;
    }
  });

  // ---------- config form (editing a profile) ----------
  function renderColorSwatches(currentColor) {
    $("#color-swatches").innerHTML = PALETTE.map((color) => (
      \`<span class="swatch \${color === currentColor ? "selected" : ""}"
             style="background: \${color}" data-color="\${color}"></span>\`
    )).join("");
    $("#color-swatches").querySelectorAll(".swatch").forEach((el) => {
      el.addEventListener("click", () => {
        $("#color-swatches").querySelectorAll(".swatch").forEach((s) => s.classList.remove("selected"));
        el.classList.add("selected");
      });
    });
  }

  function renderConfigForm() {
    const p = profiles.find((x) => x.id === editingId);
    if (!p) return;
    $("#config-target").innerHTML = \`<span class="pill profile-pill"><span class="dot" style="background: \${p.color}"></span>\${esc(p.name)}</span>\`;
    $("#f-name").value = p.name;
    renderColorSwatches(p.color);
    $("#f-model").value = p.model;
    $("#f-audioTool").value = p.audioTool;
    $("#f-sampleRate").value = p.sampleRate;
    $("#f-maxRecordingSeconds").value = p.maxRecordingSeconds;
    $("#f-autoPaste").checked = p.autoPaste;
    $("#f-notify").checked = p.notify;
    $("#f-systemInstruction").value = p.systemInstruction;

    $("#delete-profile").disabled = profiles.length <= 1;
  }

  $("#save-config").addEventListener("click", async () => {
    const selectedSwatch = $("#color-swatches .swatch.selected");
    const body = {
      name: $("#f-name").value.trim() || "Untitled",
      color: selectedSwatch ? selectedSwatch.dataset.color : undefined,
      model: $("#f-model").value.trim(),
      audioTool: $("#f-audioTool").value,
      sampleRate: parseInt($("#f-sampleRate").value, 10),
      maxRecordingSeconds: parseInt($("#f-maxRecordingSeconds").value, 10),
      autoPaste: $("#f-autoPaste").checked,
      notify: $("#f-notify").checked,
      systemInstruction: $("#f-systemInstruction").value,
    };
    try {
      await api("PUT", \`/api/profiles/\${editingId}\`, body);
      toast("Saved.", "ok");
      await loadProfiles();
    } catch (err) { toast(err.message, "bad"); }
  });

  $("#reload-config").addEventListener("click", () => {
    renderConfigForm();
    toast("Reverted.");
  });

  $("#delete-profile").addEventListener("click", () => deleteProfile(editingId));

  // ---------- API key ----------
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
      toast("Saved.", "ok");
      loadApiKey();
    } catch (err) { toast(err.message, "bad"); }
  });
  $("#clear-key").addEventListener("click", async () => {
    if (!confirm("Clear the saved API key?")) return;
    await api("DELETE", "/api/api-key");
    toast("Cleared.", "ok");
    loadApiKey();
  });
  $("#test-key").addEventListener("click", async () => {
    const el = $("#test-result");
    el.hidden = false; el.className = "badge"; el.textContent = "Testing…";
    try {
      const r = await api("POST", "/api/test-connection");
      if (r.ok) {
        el.className = "badge good";
        el.textContent = \`✓ OK · \${r.model} · \${r.latencyMs}ms\`;
      } else {
        el.className = "badge bad"; el.textContent = "✗ " + (r.error || "failed");
      }
    } catch (err) { el.className = "badge bad"; el.textContent = "✗ " + err.message; }
  });

  // ---------- history ----------
  async function loadHistory() {
    const data = await api("GET", "/api/history");
    $("#history-count").textContent = data.entries.length;
    const c = $("#history-container");
    if (data.entries.length === 0) {
      c.innerHTML = '<div class="empty">No transcriptions yet. Press your Voice Coder shortcut to record.</div>';
      return;
    }
    const rows = data.entries.map((e, i) => {
      const profile = profiles.find((p) => p.id === e.profileId);
      const profileChip = profile
        ? \`<span class="pill profile-pill"><span class="dot" style="background: \${profile.color}"></span>\${esc(profile.name)}</span>\`
        : (e.profileName ? \`<span class="pill">\${esc(e.profileName)}</span>\` : '<span class="meta">—</span>');
      const cell = e.error
        ? \`<td class="error">⚠ \${esc(e.error)}</td>\`
        : \`<td class="text">\${esc(e.text)}</td>\`;
      return \`<tr>
        <td class="ts">\${fmt(e.ts)}</td>
        <td class="profile">\${profileChip}</td>
        \${cell}
        <td><span class="pill">\${e.durationMs}ms</span> <span class="pill">\${Math.round((e.audioBytes||0)/1024)}kB</span></td>
        <td class="actions">\${e.error ? "" : \`<button class="btn ghost" data-copy="\${i}">Copy</button>\`}</td>
      </tr>\`;
    }).join("");
    c.innerHTML = \`<table class="history">
      <thead><tr><th>When</th><th>Profile</th><th>Transcript</th><th></th><th></th></tr></thead>
      <tbody>\${rows}</tbody>
    </table>\`;
    c.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const i = +btn.dataset.copy;
        await navigator.clipboard.writeText(data.entries[i].text);
        toast("Copied.", "ok");
      });
    });
  }
  $("#refresh-history").addEventListener("click", loadHistory);
  $("#clear-history").addEventListener("click", async () => {
    if (!confirm("Delete all history entries?")) return;
    await api("DELETE", "/api/history");
    toast("Cleared.", "ok");
    loadHistory();
  });

  // ---------- logs ----------
  let logsTimer = null;
  async function loadLogs() {
    const data = await api("GET", "/api/logs");
    const c = $("#logs-container");
    if (data.lines.length === 0) {
      c.innerHTML = '<div class="empty">(no log entries yet)</div>';
    } else {
      c.innerHTML = data.lines.map((line) => {
        const cls = line.includes("[error]") ? "error" : line.includes("[warn]") ? "warn" : "info";
        return \`<div class="line \${cls}">\${esc(line)}</div>\`;
      }).join("");
      c.scrollTop = c.scrollHeight;
    }
  }
  $("#refresh-logs").addEventListener("click", loadLogs);
  $("#clear-logs").addEventListener("click", async () => {
    if (!confirm("Clear log file?")) return;
    await api("DELETE", "/api/logs");
    toast("Cleared.", "ok");
    loadLogs();
  });
  function setLogsAutoRefresh(on) {
    if (logsTimer) { clearInterval(logsTimer); logsTimer = null; }
    if (on) logsTimer = setInterval(() => { if (currentTab === "logs") loadLogs(); }, 2000);
  }
  $("#f-auto-refresh").addEventListener("change", (e) => setLogsAutoRefresh(e.target.checked));
  setLogsAutoRefresh(true);

  // ---------- record (test) ----------
  let recordState = "idle";
  let recordStartedAt = 0;
  let recordTimer = null;
  let recordBusy = false;
  let stopAbort = null;
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
      lbl.textContent = "Record"; cancel.hidden = true; status.hidden = true;
      $("#record-timer").textContent = "00:00";
    } else if (state === "recording") {
      lbl.textContent = "Stop"; cancel.hidden = false; status.hidden = true;
    } else if (state === "transcribing") {
      lbl.textContent = "Transcribing…";
      cancel.hidden = false;
      status.hidden = false; status.className = "badge"; status.textContent = opts.label || "calling Gemini…";
    }
  }
  function startTimer() {
    if (recordTimer) clearInterval(recordTimer);
    recordTimer = setInterval(() => {
      $("#record-timer").textContent = fmtElapsed(Date.now() - recordStartedAt);
    }, 250);
  }
  function stopTimer() { if (recordTimer) { clearInterval(recordTimer); recordTimer = null; } }

  async function refreshRecordStatus() {
    try {
      const s = await api("GET", "/api/record/status");
      if (s.state === "recording" && recordState !== "recording" && recordState !== "transcribing") {
        recordStartedAt = s.startedAt; setRecordUi("recording"); startTimer();
      } else if (s.state === "idle" && recordState === "recording") {
        setRecordUi("idle"); stopTimer();
      }
    } catch { /* server gone */ }
  }
  function startStatusPoll() {
    if (recordStatusPoll) clearInterval(recordStatusPoll);
    recordStatusPoll = setInterval(refreshRecordStatus, 1500);
  }

  async function recordToggle() {
    if (recordBusy || recordState === "transcribing") return;
    recordBusy = true;
    $("#record-btn").disabled = true;
    try {
      if (recordState === "idle") {
        const s = await api("POST", "/api/record/start");
        recordStartedAt = s.startedAt || Date.now();
        setRecordUi("recording"); startTimer();
      } else if (recordState === "recording") {
        stopTimer(); setRecordUi("transcribing");
        stopAbort = new AbortController();
        const r = await api("POST", "/api/record/stop", { paste: false }, stopAbort.signal);
        showResult(r); setRecordUi("idle");
        if (currentTab === "history") loadHistory();
      }
    } catch (err) {
      if (err.name === "AbortError") toast("Cancelled.");
      else toast(err.message, "bad");
      setRecordUi("idle");
    } finally {
      stopAbort = null; recordBusy = false;
      if (recordState !== "transcribing") $("#record-btn").disabled = false;
    }
  }
  function showResult(r) {
    $("#record-result").hidden = false;
    $("#record-text").value = r.text || "";
    $("#record-result-meta").textContent = \`\${r.durationMs}ms · \${Math.round((r.audioBytes||0)/1024)} kB · paste=\${r.paste}\`;
    toast("Transcribed — copied to clipboard.", "ok");
  }
  $("#record-btn").addEventListener("click", recordToggle);
  $("#record-cancel").addEventListener("click", async () => {
    if (stopAbort) { stopAbort.abort(); stopAbort = null; return; }
    try { await api("POST", "/api/record/cancel"); } catch (err) { toast(err.message, "bad"); }
    stopTimer(); setRecordUi("idle");
  });
  $("#record-copy").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("#record-text").value);
    toast("Copied.", "ok");
  });
  $("#record-clear").addEventListener("click", () => {
    $("#record-result").hidden = true; $("#record-text").value = "";
  });

  // ---------- keyboard shortcuts on Home ----------
  document.addEventListener("keydown", (e) => {
    // Don't hijack typing in inputs
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
    if (currentTab !== "home") return;

    if (e.key >= "1" && e.key <= "9") {
      const idx = parseInt(e.key, 10) - 1;
      const p = profiles[idx];
      if (p) { selectedId = p.id; activateProfile(p.id); }
      e.preventDefault();
      return;
    }

    const idx = profiles.findIndex((p) => p.id === selectedId);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      const next = Math.min(profiles.length - 1, Math.max(0, idx) + 1);
      selectedId = profiles[next].id;
      renderTiles(); e.preventDefault();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      const prev = Math.max(0, Math.max(0, idx) - 1);
      selectedId = profiles[prev].id;
      renderTiles(); e.preventDefault();
    } else if (e.key === "Enter") {
      if (selectedId) activateProfile(selectedId);
      e.preventDefault();
    } else if (e.key === "e" || e.key === "E") {
      if (selectedId) { editingId = selectedId; switchTab("config"); }
      e.preventDefault();
    } else if (e.key === "n" || e.key === "N") {
      openNewModal(); e.preventDefault();
    } else if (e.key === "d" || e.key === "D") {
      if (selectedId) deleteProfile(selectedId);
      e.preventDefault();
    }
  });

  // ---------- boot ----------
  async function boot() {
    try {
      const cfg = await api("GET", "/api/config");
      $("#meta-key-path").textContent = cfg.paths.apiKeyFile;
      $("#foot-paste").textContent = "paste: " + cfg.pasteTool;
      await Promise.all([loadProfiles(), loadApiKey(), refreshRecordStatus()]);
      startStatusPoll();
    } catch (err) {
      toast("Boot failed: " + err.message, "bad");
    }
  }
  boot();
})();
</script>

</body>
</html>`;
