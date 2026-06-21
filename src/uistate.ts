// A tiny shared "current UI state" file that the tray indicator watches.
// Separate from the lockfile because the tray needs to distinguish
// idle / recording / transcribing, and wants the last transcript for a
// tooltip — none of which the lockfile carries.

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export type UiState = "idle" | "recording" | "transcribing";

export const STATE_FILE = path.join(os.tmpdir(), `voice-coder-${process.env.USER ?? "user"}.state`);
export const TRAY_PIDFILE = path.join(
  os.tmpdir(),
  `voice-coder-${process.env.USER ?? "user"}.tray.pid`,
);

export interface UiStatePayload {
  state: UiState;
  text?: string; // last transcript (for the tooltip / "done" flash)
  error?: string;
  ts: number;
}

export function writeUiState(state: UiState, extra: { text?: string; error?: string } = {}): void {
  const payload: UiStatePayload = { state, ...extra, ts: Date.now() };
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(payload));
  } catch {
    /* never let UI state writes break the flow */
  }
}

export function readUiState(): UiStatePayload {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as UiStatePayload;
  } catch {
    return { state: "idle", ts: 0 };
  }
}

// True if a tray indicator process is alive — used to suppress popup
// notifications (the tray is the indicator instead).
export function isTrayRunning(): boolean {
  try {
    if (!fs.existsSync(TRAY_PIDFILE)) return false;
    const pid = parseInt(fs.readFileSync(TRAY_PIDFILE, "utf8").trim(), 10);
    if (!Number.isFinite(pid) || pid <= 0) return false;
    process.kill(pid, 0); // throws if not alive
    return true;
  } catch {
    return false;
  }
}
