// Shared record/stop/cancel state machine.
// Used by the CLI commands AND the HTTP server, so the keyboard shortcut and
// the web UI operate on the same lockfile and can each see what the other
// started.
//
// State lives in /tmp/voice-coder-${USER}.lock — a JSON file containing the
// recorder process pid and the temp WAV path. While that file exists with a
// live pid, we're "recording".

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { randomUUID } from "node:crypto";

import { AudioRecorder, type AudioTool } from "../recorder";
import { transcribe } from "../transcriber";
import { loadConfig, loadApiKey } from "./config";
import { writeClipboard, firePaste } from "./inject";
import { appendHistory, log } from "./store";

export const LOCKFILE = path.join(os.tmpdir(), `voice-coder-${process.env.USER ?? "user"}.lock`);

interface LockState {
  pid: number;
  wavPath: string;
  startedAt: number;
  tool: AudioTool;
}

export interface SessionStatus {
  state: "idle" | "recording";
  pid?: number;
  startedAt?: number;
  elapsedMs?: number;
  tool?: AudioTool;
}

export interface TranscribeResult {
  text: string;
  durationMs: number;
  audioBytes: number;
  paste: "fired" | "skipped" | "unavailable";
}

// ----- public API -----

export function isRecording(): boolean {
  return readLock() !== null;
}

export function getStatus(): SessionStatus {
  const state = readLock();
  if (!state) return { state: "idle" };
  return {
    state: "recording",
    pid: state.pid,
    startedAt: state.startedAt,
    elapsedMs: Date.now() - state.startedAt,
    tool: state.tool,
  };
}

export function startRecording(): LockState {
  if (readLock() !== null) {
    throw new Error("Already recording. Stop or cancel first.");
  }
  const cfg = loadConfig();
  const tool = AudioRecorder.detect(cfg.audioTool);
  const wavPath = path.join(os.tmpdir(), `voice-coder-${randomUUID()}.wav`);
  const { bin, args } = buildRecorderCommand(tool, cfg.sampleRate, wavPath);

  const proc = spawn(bin, args, { stdio: "ignore", detached: true });
  proc.unref();
  if (!proc.pid) throw new Error(`Failed to spawn ${bin}`);

  const state: LockState = { pid: proc.pid, wavPath, startedAt: Date.now(), tool };
  fs.writeFileSync(LOCKFILE, JSON.stringify(state));
  log("info", `Started recording (pid=${proc.pid}, tool=${tool}, wav=${wavPath})`);
  scheduleWatchdog(proc.pid, cfg.maxRecordingSeconds);
  return state;
}

export interface StopOptions {
  /** Default true. Set false when triggered from the UI so the keystroke doesn't land in the browser. */
  paste?: boolean;
  /** Default true. */
  copyToClipboard?: boolean;
}

export async function stopAndTranscribe(opts: StopOptions = {}): Promise<TranscribeResult> {
  const paste = opts.paste ?? true;
  const copy = opts.copyToClipboard ?? true;

  const state = readLock();
  if (!state) throw new Error("Not recording.");
  const cfg = loadConfig();
  const apiKey = loadApiKey();
  if (!apiKey) {
    cleanupAfterStop(state.pid, state.wavPath, true);
    throw new Error("No Gemini API key. Run `voice-coder set-key` or set it in the UI.");
  }

  try { process.kill(state.pid, "SIGINT"); } catch { /* already gone */ }
  await waitForExit(state.pid, 3000);
  fs.rmSync(LOCKFILE, { force: true });

  if (!fs.existsSync(state.wavPath) || fs.statSync(state.wavPath).size < 1024) {
    AudioRecorder.cleanup(state.wavPath);
    throw new Error("Recording produced no audio (check your default mic).");
  }

  const audioBytes = fs.statSync(state.wavPath).size;
  const t0 = Date.now();
  let text: string;
  try {
    text = await transcribe({
      apiKey,
      model: cfg.model,
      systemInstruction: cfg.systemInstruction,
      wavPath: state.wavPath,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", `Transcription failed (model=${cfg.model}): ${msg}`);
    appendHistory({
      ts: new Date().toISOString(),
      model: cfg.model,
      text: "",
      durationMs: Date.now() - t0,
      audioBytes,
      error: msg,
    });
    throw err;
  } finally {
    AudioRecorder.cleanup(state.wavPath);
  }

  const durationMs = Date.now() - t0;
  log("info", `Transcribed (model=${cfg.model}, ${audioBytes}B audio, ${durationMs}ms, ${text.length} chars)`);
  appendHistory({
    ts: new Date().toISOString(),
    model: cfg.model,
    text,
    durationMs,
    audioBytes,
  });

  if (copy) writeClipboard(text);

  let pasteResult: "fired" | "skipped" | "unavailable" = "skipped";
  if (paste && cfg.autoPaste) {
    pasteResult = firePaste() ? "fired" : "unavailable";
  }

  return { text, durationMs, audioBytes, paste: pasteResult };
}

export function cancelRecording(): boolean {
  const state = readLock();
  if (!state) return false;
  cleanupAfterStop(state.pid, state.wavPath, true);
  log("info", `Recording cancelled`);
  return true;
}

// ----- internals -----

function readLock(): LockState | null {
  if (!fs.existsSync(LOCKFILE)) return null;
  try {
    const state = JSON.parse(fs.readFileSync(LOCKFILE, "utf8")) as LockState;
    // Stale lockfile — process is gone. Clean up.
    try { process.kill(state.pid, 0); } catch {
      fs.rmSync(LOCKFILE, { force: true });
      AudioRecorder.cleanup(state.wavPath);
      return null;
    }
    return state;
  } catch {
    fs.rmSync(LOCKFILE, { force: true });
    return null;
  }
}

function cleanupAfterStop(pid: number, wavPath: string, killProc: boolean): void {
  if (killProc) {
    try { process.kill(pid, "SIGINT"); } catch { /* noop */ }
    setTimeout(() => { try { process.kill(pid, "SIGKILL"); } catch { /* noop */ } }, 800).unref();
  }
  fs.rmSync(LOCKFILE, { force: true });
  AudioRecorder.cleanup(wavPath);
}

function buildRecorderCommand(tool: AudioTool, sr: number, out: string): { bin: string; args: string[] } {
  const r = String(sr);
  switch (tool) {
    case "arecord":
      return { bin: "arecord", args: ["-q", "-f", "S16_LE", "-r", r, "-c", "1", "-t", "wav", out] };
    case "sox":
      return { bin: "sox", args: ["-q", "-d", "-r", r, "-c", "1", "-b", "16", out] };
    case "ffmpeg":
      return { bin: "ffmpeg", args: ["-loglevel", "error", "-f", "alsa", "-i", "default", "-ar", r, "-ac", "1", "-y", out] };
  }
}

function scheduleWatchdog(pid: number, maxSeconds: number): void {
  const script = `sleep ${maxSeconds}; kill -INT ${pid} 2>/dev/null; true`;
  const w = spawn("sh", ["-c", script], { stdio: "ignore", detached: true });
  w.unref();
}

async function waitForExit(pid: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { process.kill(pid, 0); } catch { return; }
    await new Promise((r) => setTimeout(r, 50));
  }
}
