// Dashboard client app. Bundled separately (out/dashboard.js, browser IIFE)
// and served by server.ts at /app.js. Talks to the /api routes using the
// per-session CSRF token embedded in the page's <meta name="vc-token">.

import type { Profile } from "../profiles";
import type { HistoryEntry } from "../store";

interface RecordStopResult {
  text?: string;
  durationMs: number;
  audioBytes: number;
  paste: string;
}

// ---------- helpers ----------
const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing element: ${sel}`);
  return el;
};
const $$ = <T extends HTMLElement = HTMLElement>(sel: string): T[] =>
  Array.from(document.querySelectorAll<T>(sel));

let toastTimer: number | undefined;
function toast(msg: string, kind = ""): void {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast show " + kind;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("show"), 2200);
}

const VC_TOKEN = document.querySelector<HTMLMetaElement>('meta[name="vc-token"]')?.content ?? "";

async function api<T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const opts: RequestInit = { method, headers: { "X-VC-Token": VC_TOKEN }, signal };
  if (body !== undefined) {
    (opts.headers as Record<string, string>)["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(path, opts);
  const text = await r.text();
  const data = (text ? JSON.parse(text) : {}) as T & { error?: string };
  if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
  return data;
}

function fmt(ts: string): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });
}

function esc(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Colors land in style attributes — only ever emit a known-safe hex value. */
function safeColor(c: unknown): string {
  return typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#7aa7ff";
}

// ---------- state ----------
let profiles: Profile[] = [];
let activeId: string | null = null;
let selectedId: string | null = null; // tile selection (independent of active)
let editingId: string | null = null; // profile being edited in Config tab
let currentTab = "home";

const PALETTE = [
  "#7aa7ff",
  "#5cdd8b",
  "#ffb454",
  "#ff7a90",
  "#b48cff",
  "#5ed4e0",
  "#ffd166",
  "#ff9d6f",
];

// ---------- tabs ----------
$$("#nav button").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab!)));
function switchTab(name: string): void {
  currentTab = name;
  $$("#nav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  $$("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== name));
  if (name === "home") renderTiles();
  if (name === "config") renderConfigForm();
  if (name === "history") void loadHistory();
  if (name === "logs") void loadLogs();
}

// ---------- profiles ----------
async function loadProfiles(): Promise<void> {
  const data = await api<{ profiles: Profile[]; activeId: string }>("GET", "/api/profiles");
  profiles = data.profiles;
  activeId = data.activeId;
  if (!selectedId || !profiles.find((p) => p.id === selectedId)) selectedId = activeId;
  if (!editingId || !profiles.find((p) => p.id === editingId)) editingId = activeId;
  renderFooter();
  if (currentTab === "home") renderTiles();
  if (currentTab === "config") renderConfigForm();
}

function renderFooter(): void {
  const active = profiles.find((p) => p.id === activeId);
  if (!active) return;
  $("#foot-active-name").textContent = active.name;
  $("#foot-swatch").style.background = safeColor(active.color);
}

function renderTiles(): void {
  const grid = $("#tile-grid");
  const tiles = profiles
    .map((p, i) => {
      const preview = (p.systemInstruction || "").trim().slice(0, 160).replace(/\s+/g, " ");
      const isActive = p.id === activeId;
      const isSelected = p.id === selectedId;
      return `<div class="tile ${isActive ? "active" : ""} ${isSelected ? "selected" : ""}"
              style="--tile-color: ${safeColor(p.color)}" data-id="${esc(p.id)}" data-i="${i}" tabindex="0">
      <span class="num">${i + 1}</span>
      <button class="menu-btn" data-menu="${esc(p.id)}" title="More options" aria-label="More options">⋮</button>
      <div class="menu-pop" data-menu-pop="${esc(p.id)}">
        <button data-edit="${esc(p.id)}">Edit <span class="menu-shortcut">E</span></button>
        <button data-activate="${esc(p.id)}" ${isActive ? "disabled" : ""}>Set as active <span class="menu-shortcut">↵</span></button>
        <div class="sep"></div>
        <button class="danger" data-del="${esc(p.id)}">Delete <span class="menu-shortcut">D</span></button>
      </div>
      <div class="name">${esc(p.name)}</div>
      <div class="model">${esc(p.model)}</div>
      <div class="preview">${esc(preview)}</div>
      <div class="footer">
        ${isActive ? '<span class="badge-on">● active</span>' : '<span class="meta">tap to activate</span>'}
      </div>
    </div>`;
    })
    .join("");

  const addTile = `<div class="tile add" id="tile-add">
    <div>
      <div class="plus">+</div>
      <div class="label">New profile</div>
    </div>
  </div>`;

  grid.innerHTML = tiles + addTile;

  grid.querySelectorAll<HTMLElement>(".tile[data-id]").forEach((el) => {
    el.addEventListener("click", () => void activateProfile(el.dataset.id!));
  });
  grid.querySelectorAll<HTMLElement>("[data-menu]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const tile = btn.closest(".tile")!;
      const wasOpen = tile.classList.contains("menu-open");
      closeAllMenus();
      if (!wasOpen) tile.classList.add("menu-open");
    });
  });
  grid.querySelectorAll<HTMLElement>(".menu-pop").forEach((pop) => {
    // Clicks INSIDE the menu shouldn't bubble to the tile (which would activate it)
    pop.addEventListener("click", (e) => e.stopPropagation());
  });
  grid.querySelectorAll<HTMLElement>("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllMenus();
      editingId = btn.dataset.edit!;
      selectedId = btn.dataset.edit!;
      switchTab("config");
    });
  });
  grid.querySelectorAll<HTMLElement>("[data-activate]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllMenus();
      void activateProfile(btn.dataset.activate!);
    });
  });
  grid.querySelectorAll<HTMLElement>("[data-del]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllMenus();
      void deleteProfile(btn.dataset.del!);
    });
  });
  $("#tile-add").addEventListener("click", openNewModal);
}

function closeAllMenus(): void {
  document.querySelectorAll(".tile.menu-open").forEach((t) => t.classList.remove("menu-open"));
}
// Close any open kebab menu on outside click / Escape
document.addEventListener("click", closeAllMenus);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAllMenus();
});

async function activateProfile(id: string): Promise<void> {
  try {
    await api("POST", `/api/profiles/${id}/activate`);
    selectedId = id;
    const p = profiles.find((x) => x.id === id);
    toast(`Activated: ${p?.name ?? id}`, "ok");
    await loadProfiles();
  } catch (err) {
    toast((err as Error).message, "bad");
  }
}

async function deleteProfile(id: string): Promise<void> {
  const p = profiles.find((x) => x.id === id);
  if (!p) return;
  if (!confirm(`Delete profile "${p.name}"?`)) return;
  try {
    await api("DELETE", `/api/profiles/${id}`);
    toast("Deleted.", "ok");
    if (selectedId === id) selectedId = null;
    if (editingId === id) editingId = null;
    await loadProfiles();
  } catch (err) {
    toast((err as Error).message, "bad");
  }
}

// ---- new-profile modal
function renderNewSwatches(): void {
  const used = new Set(profiles.map((p) => p.color));
  const c = PALETTE.find((x) => !used.has(x)) || PALETTE[0];
  $("#new-swatches").innerHTML = PALETTE.map(
    (color) =>
      `<span class="swatch ${color === c ? "selected" : ""}"
           style="background: ${color}" data-color="${color}"></span>`,
  ).join("");
  $("#new-swatches")
    .querySelectorAll<HTMLElement>(".swatch")
    .forEach((el) => {
      el.addEventListener("click", () => {
        $("#new-swatches")
          .querySelectorAll(".swatch")
          .forEach((s) => s.classList.remove("selected"));
        el.classList.add("selected");
      });
    });
}
function openNewModal(): void {
  $<HTMLInputElement>("#new-name").value = "";
  renderNewSwatches();
  $("#modal-new").hidden = false;
  setTimeout(() => $("#new-name").focus(), 30);
}
function closeNewModal(): void {
  $("#modal-new").hidden = true;
}
$("#new-cancel").addEventListener("click", closeNewModal);
$("#modal-new").addEventListener("click", (e) => {
  if ((e.target as HTMLElement).id === "modal-new") closeNewModal();
});
let creatingProfile = false;
$("#new-create").addEventListener("click", () => {
  void (async () => {
    if (creatingProfile) return; // hard-lock against rapid double-click
    const name = $<HTMLInputElement>("#new-name").value.trim();
    if (!name) {
      toast("Pick a name.", "bad");
      return;
    }
    const selectedSwatch = document.querySelector<HTMLElement>("#new-swatches .swatch.selected");
    const color = selectedSwatch?.dataset.color ?? PALETTE[0];

    creatingProfile = true;
    const btn = $<HTMLButtonElement>("#new-create");
    const origLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Creating…";

    try {
      const p = await api<Profile>("POST", "/api/profiles", { name, color });
      toast(`Created: ${p.name}`, "ok");
      selectedId = p.id;
      editingId = p.id;
      await loadProfiles();
      switchTab("config");
    } catch (err) {
      toast((err as Error).message, "bad");
    } finally {
      // Always close the modal so the user isn't stuck, even if something
      // downstream threw after the profile was actually saved on disk.
      closeNewModal();
      creatingProfile = false;
      btn.disabled = false;
      btn.textContent = origLabel;
    }
  })();
});

// ---------- config form (editing a profile) ----------
function renderColorSwatches(currentColor: string): void {
  $("#color-swatches").innerHTML = PALETTE.map(
    (color) =>
      `<span class="swatch ${color === currentColor ? "selected" : ""}"
           style="background: ${color}" data-color="${color}"></span>`,
  ).join("");
  $("#color-swatches")
    .querySelectorAll<HTMLElement>(".swatch")
    .forEach((el) => {
      el.addEventListener("click", () => {
        $("#color-swatches")
          .querySelectorAll(".swatch")
          .forEach((s) => s.classList.remove("selected"));
        el.classList.add("selected");
      });
    });
}

function renderConfigForm(): void {
  const p = profiles.find((x) => x.id === editingId);
  if (!p) return;
  $("#config-target").innerHTML =
    `<span class="pill profile-pill"><span class="dot" style="background: ${safeColor(p.color)}"></span>${esc(p.name)}</span>`;
  $<HTMLInputElement>("#f-name").value = p.name;
  renderColorSwatches(p.color);
  $<HTMLInputElement>("#f-model").value = p.model;
  $<HTMLSelectElement>("#f-audioTool").value = p.audioTool;
  $<HTMLInputElement>("#f-sampleRate").value = String(p.sampleRate);
  $<HTMLInputElement>("#f-maxRecordingSeconds").value = String(p.maxRecordingSeconds);
  $<HTMLInputElement>("#f-autoPaste").checked = p.autoPaste;
  $<HTMLInputElement>("#f-notify").checked = p.notify;
  $<HTMLTextAreaElement>("#f-systemInstruction").value = p.systemInstruction;

  $<HTMLButtonElement>("#delete-profile").disabled = profiles.length <= 1;
}

$("#save-config").addEventListener("click", () => {
  void (async () => {
    const selectedSwatch = document.querySelector<HTMLElement>("#color-swatches .swatch.selected");
    const body = {
      name: $<HTMLInputElement>("#f-name").value.trim() || "Untitled",
      color: selectedSwatch?.dataset.color,
      model: $<HTMLInputElement>("#f-model").value.trim(),
      audioTool: $<HTMLSelectElement>("#f-audioTool").value,
      sampleRate: parseInt($<HTMLInputElement>("#f-sampleRate").value, 10),
      maxRecordingSeconds: parseInt($<HTMLInputElement>("#f-maxRecordingSeconds").value, 10),
      autoPaste: $<HTMLInputElement>("#f-autoPaste").checked,
      notify: $<HTMLInputElement>("#f-notify").checked,
      systemInstruction: $<HTMLTextAreaElement>("#f-systemInstruction").value,
    };
    try {
      await api("PUT", `/api/profiles/${editingId}`, body);
      toast("Saved.", "ok");
      await loadProfiles();
    } catch (err) {
      toast((err as Error).message, "bad");
    }
  })();
});

$("#reload-config").addEventListener("click", () => {
  renderConfigForm();
  toast("Reverted.");
});

$("#delete-profile").addEventListener("click", () => {
  if (editingId) void deleteProfile(editingId);
});

// ---------- API key ----------
async function loadApiKey(): Promise<void> {
  const data = await api<{ set: boolean; masked: string | null }>("GET", "/api/api-key");
  $<HTMLInputElement>("#f-apikey-masked").value = data.set ? (data.masked ?? "") : "";
  $<HTMLInputElement>("#f-apikey-masked").placeholder = data.set ? "" : "(not set)";
}
$("#save-key").addEventListener("click", () => {
  void (async () => {
    const k = $<HTMLInputElement>("#f-apikey").value;
    if (!k.trim()) return toast("Paste a key first.", "bad");
    try {
      await api("PUT", "/api/api-key", { key: k });
      $<HTMLInputElement>("#f-apikey").value = "";
      toast("Saved.", "ok");
      void loadApiKey();
    } catch (err) {
      toast((err as Error).message, "bad");
    }
  })();
});
$("#clear-key").addEventListener("click", () => {
  void (async () => {
    if (!confirm("Clear the saved API key?")) return;
    await api("DELETE", "/api/api-key");
    toast("Cleared.", "ok");
    void loadApiKey();
  })();
});
$("#test-key").addEventListener("click", () => {
  void (async () => {
    const el = $("#test-result");
    el.hidden = false;
    el.className = "badge";
    el.textContent = "Testing…";
    try {
      const r = await api<{ ok: boolean; model?: string; latencyMs?: number; error?: string }>(
        "POST",
        "/api/test-connection",
      );
      if (r.ok) {
        el.className = "badge good";
        el.textContent = `✓ OK · ${r.model} · ${r.latencyMs}ms`;
      } else {
        el.className = "badge bad";
        el.textContent = "✗ " + (r.error || "failed");
      }
    } catch (err) {
      el.className = "badge bad";
      el.textContent = "✗ " + (err as Error).message;
    }
  })();
});

// ---------- history ----------
async function loadHistory(): Promise<void> {
  const data = await api<{ entries: HistoryEntry[] }>("GET", "/api/history");
  $("#history-count").textContent = String(data.entries.length);
  const c = $("#history-container");
  if (data.entries.length === 0) {
    c.innerHTML =
      '<div class="empty">No transcriptions yet. Press your Voice Coder shortcut to record.</div>';
    return;
  }
  const rows = data.entries
    .map((e, i) => {
      const profile = profiles.find((p) => p.id === e.profileId);
      const profileChip = profile
        ? `<span class="pill profile-pill"><span class="dot" style="background: ${safeColor(profile.color)}"></span>${esc(profile.name)}</span>`
        : e.profileName
          ? `<span class="pill">${esc(e.profileName)}</span>`
          : '<span class="meta">—</span>';
      const cell = e.error
        ? `<td class="error">⚠ ${esc(e.error)}</td>`
        : `<td class="text">${esc(e.text)}</td>`;
      return `<tr>
      <td class="ts">${fmt(e.ts)}</td>
      <td class="profile">${profileChip}</td>
      ${cell}
      <td><span class="pill">${e.durationMs}ms</span> <span class="pill">${Math.round((e.audioBytes || 0) / 1024)}kB</span></td>
      <td class="actions">${e.error ? "" : `<button class="btn ghost" data-copy="${i}">Copy</button>`}</td>
    </tr>`;
    })
    .join("");
  c.innerHTML = `<table class="history">
    <thead><tr><th>When</th><th>Profile</th><th>Transcript</th><th></th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
  c.querySelectorAll<HTMLElement>("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      void (async () => {
        const i = Number(btn.dataset.copy);
        await navigator.clipboard.writeText(data.entries[i].text);
        toast("Copied.", "ok");
      })();
    });
  });
}
$("#refresh-history").addEventListener("click", () => void loadHistory());
$("#clear-history").addEventListener("click", () => {
  void (async () => {
    if (!confirm("Delete all history entries?")) return;
    await api("DELETE", "/api/history");
    toast("Cleared.", "ok");
    void loadHistory();
  })();
});

// ---------- logs ----------
let logsTimer: number | null = null;
async function loadLogs(): Promise<void> {
  const data = await api<{ lines: string[] }>("GET", "/api/logs");
  const c = $("#logs-container");
  if (data.lines.length === 0) {
    c.innerHTML = '<div class="empty">(no log entries yet)</div>';
  } else {
    c.innerHTML = data.lines
      .map((line) => {
        const cls = line.includes("[error]") ? "error" : line.includes("[warn]") ? "warn" : "info";
        return `<div class="line ${cls}">${esc(line)}</div>`;
      })
      .join("");
    c.scrollTop = c.scrollHeight;
  }
}
$("#refresh-logs").addEventListener("click", () => void loadLogs());
$("#clear-logs").addEventListener("click", () => {
  void (async () => {
    if (!confirm("Clear log file?")) return;
    await api("DELETE", "/api/logs");
    toast("Cleared.", "ok");
    void loadLogs();
  })();
});
function setLogsAutoRefresh(on: boolean): void {
  if (logsTimer) {
    clearInterval(logsTimer);
    logsTimer = null;
  }
  if (on)
    logsTimer = window.setInterval(() => {
      if (currentTab === "logs") void loadLogs();
    }, 2000);
}
$("#f-auto-refresh").addEventListener("change", (e) => {
  setLogsAutoRefresh((e.target as HTMLInputElement).checked);
});
setLogsAutoRefresh(true);

// ---------- record (test) ----------
type RecordState = "idle" | "recording" | "transcribing";
let recordState: RecordState = "idle";
let recordStartedAt = 0;
let recordTimer: number | null = null;
let recordBusy = false;
let stopAbort: AbortController | null = null;
let recordStatusPoll: number | null = null;

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}
function setRecordUi(state: RecordState, opts: { label?: string } = {}): void {
  recordState = state;
  const btn = $<HTMLButtonElement>("#record-btn");
  const lbl = $("#record-label");
  const cancel = $("#record-cancel");
  const status = $("#record-status");
  btn.classList.toggle("recording", state === "recording");
  btn.disabled = state === "transcribing";
  if (state === "idle") {
    lbl.textContent = "Record";
    cancel.hidden = true;
    status.hidden = true;
    $("#record-timer").textContent = "00:00";
  } else if (state === "recording") {
    lbl.textContent = "Stop";
    cancel.hidden = false;
    status.hidden = true;
  } else {
    lbl.textContent = "Transcribing…";
    cancel.hidden = false;
    status.hidden = false;
    status.className = "badge";
    status.textContent = opts.label || "calling Gemini…";
  }
}
function startTimer(): void {
  if (recordTimer) clearInterval(recordTimer);
  recordTimer = window.setInterval(() => {
    $("#record-timer").textContent = fmtElapsed(Date.now() - recordStartedAt);
  }, 250);
}
function stopTimer(): void {
  if (recordTimer) {
    clearInterval(recordTimer);
    recordTimer = null;
  }
}

async function refreshRecordStatus(): Promise<void> {
  try {
    const s = await api<{ state: string; startedAt?: number }>("GET", "/api/record/status");
    if (s.state === "recording" && recordState !== "recording" && recordState !== "transcribing") {
      recordStartedAt = s.startedAt ?? Date.now();
      setRecordUi("recording");
      startTimer();
    } else if (s.state === "idle" && recordState === "recording") {
      setRecordUi("idle");
      stopTimer();
    }
  } catch {
    /* server gone */
  }
}
function startStatusPoll(): void {
  if (recordStatusPoll) clearInterval(recordStatusPoll);
  recordStatusPoll = window.setInterval(() => void refreshRecordStatus(), 1500);
}

async function recordToggle(): Promise<void> {
  if (recordBusy || recordState === "transcribing") return;
  recordBusy = true;
  $<HTMLButtonElement>("#record-btn").disabled = true;
  try {
    if (recordState === "idle") {
      const s = await api<{ startedAt?: number }>("POST", "/api/record/start");
      recordStartedAt = s.startedAt || Date.now();
      setRecordUi("recording");
      startTimer();
    } else if (recordState === "recording") {
      stopTimer();
      setRecordUi("transcribing");
      stopAbort = new AbortController();
      const r = await api<RecordStopResult>(
        "POST",
        "/api/record/stop",
        { paste: false },
        stopAbort.signal,
      );
      showResult(r);
      setRecordUi("idle");
      if (currentTab === "history") void loadHistory();
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") toast("Cancelled.");
    else toast((err as Error).message, "bad");
    setRecordUi("idle");
  } finally {
    stopAbort = null;
    recordBusy = false;
    if ((recordState as RecordState) !== "transcribing")
      $<HTMLButtonElement>("#record-btn").disabled = false;
  }
}
function showResult(r: RecordStopResult): void {
  $("#record-result").hidden = false;
  $<HTMLTextAreaElement>("#record-text").value = r.text || "";
  $("#record-result-meta").textContent =
    `${r.durationMs}ms · ${Math.round((r.audioBytes || 0) / 1024)} kB · paste=${r.paste}`;
  toast("Transcribed — copied to clipboard.", "ok");
}
$("#record-btn").addEventListener("click", () => void recordToggle());
$("#record-cancel").addEventListener("click", () => {
  void (async () => {
    if (stopAbort) {
      stopAbort.abort();
      stopAbort = null;
      return;
    }
    try {
      await api("POST", "/api/record/cancel");
    } catch (err) {
      toast((err as Error).message, "bad");
    }
    stopTimer();
    setRecordUi("idle");
  })();
});
$("#record-copy").addEventListener("click", () => {
  void (async () => {
    await navigator.clipboard.writeText($<HTMLTextAreaElement>("#record-text").value);
    toast("Copied.", "ok");
  })();
});
$("#record-clear").addEventListener("click", () => {
  $("#record-result").hidden = true;
  $<HTMLTextAreaElement>("#record-text").value = "";
});

// ---------- keyboard shortcuts on Home ----------
document.addEventListener("keydown", (e) => {
  // Don't hijack typing in inputs
  const tag = (e.target as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (currentTab !== "home") return;

  if (e.key >= "1" && e.key <= "9") {
    const idx = parseInt(e.key, 10) - 1;
    const p = profiles[idx];
    if (p) {
      selectedId = p.id;
      void activateProfile(p.id);
    }
    e.preventDefault();
    return;
  }

  const idx = profiles.findIndex((p) => p.id === selectedId);
  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    const next = Math.min(profiles.length - 1, Math.max(0, idx) + 1);
    selectedId = profiles[next].id;
    renderTiles();
    e.preventDefault();
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    const prev = Math.max(0, Math.max(0, idx) - 1);
    selectedId = profiles[prev].id;
    renderTiles();
    e.preventDefault();
  } else if (e.key === "Enter") {
    if (selectedId) void activateProfile(selectedId);
    e.preventDefault();
  } else if (e.key === "e" || e.key === "E") {
    if (selectedId) {
      editingId = selectedId;
      switchTab("config");
    }
    e.preventDefault();
  } else if (e.key === "n" || e.key === "N") {
    openNewModal();
    e.preventDefault();
  } else if (e.key === "d" || e.key === "D") {
    if (selectedId) void deleteProfile(selectedId);
    e.preventDefault();
  }
});

// ---------- stop server ----------
$("#stop-server").addEventListener("click", () => {
  void (async () => {
    if (
      !confirm(
        "Stop the Voice Coder server?\n\nThe dashboard will close and your global record shortcut will keep working (it launches its own process). Re-open this dashboard any time from your app launcher.",
      )
    )
      return;
    try {
      await api("POST", "/api/shutdown");
      // Server is going down; show a friendly end-state and try to close the window.
      document.body.innerHTML =
        '<div style="display:grid;place-items:center;height:100vh;color:#9aa1b1;' +
        'font:15px system-ui;text-align:center;background:#0a0c11">' +
        '<div><div style="font-size:32px;margin-bottom:12px">⏻</div>' +
        'Voice Coder server stopped.<br><span style="color:#6c7385;font-size:13px">' +
        "You can close this window. Re-open from your app launcher.</span></div></div>";
      setTimeout(() => {
        try {
          window.close();
        } catch {
          /* browser may refuse */
        }
      }, 1200);
    } catch (err) {
      toast((err as Error).message, "bad");
    }
  })();
});

// ---------- boot ----------
async function boot(): Promise<void> {
  try {
    const cfg = await api<{ paths: { apiKeyFile: string }; pasteTool: string }>(
      "GET",
      "/api/config",
    );
    $("#meta-key-path").textContent = cfg.paths.apiKeyFile;
    $("#foot-paste").textContent = "paste: " + cfg.pasteTool;
    await Promise.all([loadProfiles(), loadApiKey(), refreshRecordStatus()]);
    startStatusPoll();
  } catch (err) {
    toast("Boot failed: " + (err as Error).message, "bad");
  }
}
void boot();
