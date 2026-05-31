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
import { loadApiKey } from "./config";
import { getActive as getActiveProfile, listProfiles } from "./profiles";
import type { Profile } from "./profiles";
import { writeClipboard, firePaste } from "./inject";
import { appendHistory, log } from "./store";
import { writeUiState } from "./uistate";

export const LOCKFILE = path.join(os.tmpdir(), `voice-coder-${process.env.USER ?? "user"}.lock`);

interface LockState {
  pid: number;
  wavPath: string;
  startedAt: number;
  tool: AudioTool;
  profileId?: string;   // optional for backward compat with pre-profile lockfiles
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
  silent?: boolean;   // true when we skipped Gemini because the audio was silent
}

// Peak 16-bit amplitude below which we treat the recording as "no speech".
// Full scale is 32767. Room tone / muted mic peaks in the low hundreds;
// real speech peaks in the thousands. 500 (~1.5% FS) reliably separates them.
// Override with VOICE_CODER_SILENCE_PEAK if a quiet mic needs tuning.
const SILENCE_PEAK = parseInt(process.env.VOICE_CODER_SILENCE_PEAK ?? "500", 10);

/** Measure peak + RMS amplitude of a 16-bit PCM mono WAV. */
function wavLevel(wavPath: string): { peak: number; rms: number; samples: number } {
  const buf = fs.readFileSync(wavPath);
  // Locate the 'data' chunk (don't assume a fixed 44-byte header).
  let off = 12, dataOff = -1, dataLen = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "data") { dataOff = off + 8; dataLen = size; break; }
    off += 8 + size + (size & 1);
  }
  if (dataOff < 0) { dataOff = 44; dataLen = buf.length - 44; }
  dataLen = Math.max(0, Math.min(dataLen, buf.length - dataOff));
  const n = Math.floor(dataLen / 2);
  let peak = 0, sumSq = 0;
  for (let i = 0; i < n; i++) {
    const s = buf.readInt16LE(dataOff + i * 2);
    const a = s < 0 ? -s : s;
    if (a > peak) peak = a;
    sumSq += s * s;
  }
  return { peak, rms: n ? Math.sqrt(sumSq / n) : 0, samples: n };
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

export function startRecording(): LockState & { profileId: string; profileName: string } {
  if (readLock() !== null) {
    throw new Error("Already recording. Stop or cancel first.");
  }
  const profile = getActiveProfile();
  const tool = AudioRecorder.detect(profile.audioTool);
  const wavPath = path.join(os.tmpdir(), `voice-coder-${randomUUID()}.wav`);
  const { bin, args } = buildRecorderCommand(tool, profile.sampleRate, wavPath);

  const proc = spawn(bin, args, { stdio: "ignore", detached: true });
  proc.unref();
  if (!proc.pid) throw new Error(`Failed to spawn ${bin}`);

  // Lock the profile in at start time, so even if the user switches profiles
  // mid-recording the transcription uses the same one that started it.
  const state: LockState = { pid: proc.pid, wavPath, startedAt: Date.now(), tool, profileId: profile.id };
  fs.writeFileSync(LOCKFILE, JSON.stringify(state));
  writeUiState("recording");
  log("info", `Started recording (profile=${profile.name}, pid=${proc.pid}, tool=${tool}, wav=${wavPath})`);
  scheduleWatchdog(proc.pid, profile.maxRecordingSeconds);
  return { ...state, profileId: profile.id, profileName: profile.name };
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

  // Use the profile that was active when recording started (locked into the
  // lockfile). Falls back to current active profile for pre-profile lockfiles.
  const profile = profileById(state.profileId) ?? getActiveProfile();

  const apiKey = loadApiKey();
  if (!apiKey) {
    cleanupAfterStop(state.pid, state.wavPath, true);
    throw new Error("No Gemini API key. Set one in the UI or run `voice-coder set-key`.");
  }

  try { process.kill(state.pid, "SIGINT"); } catch { /* already gone */ }
  await waitForExit(state.pid, 3000);
  fs.rmSync(LOCKFILE, { force: true });
  writeUiState("transcribing");

  if (!fs.existsSync(state.wavPath) || fs.statSync(state.wavPath).size < 1024) {
    AudioRecorder.cleanup(state.wavPath);
    writeUiState("idle", { error: "no audio" });
    throw new Error("Recording produced no audio (check your default mic).");
  }

  const audioBytes = fs.statSync(state.wavPath).size;

  // Silence guard: if the recording has no real speech, DON'T call Gemini —
  // on near-empty audio the model hallucinates plausible text (often echoing
  // glossary terms from the system instruction). Skip and return silently.
  const level = wavLevel(state.wavPath);
  if (level.peak < SILENCE_PEAK) {
    AudioRecorder.cleanup(state.wavPath);
    writeUiState("idle");
    log("info", `Skipped: silent audio (peak=${level.peak}, rms=${Math.round(level.rms)}, threshold=${SILENCE_PEAK})`);
    return { text: "", durationMs: 0, audioBytes, paste: "skipped", silent: true };
  }

  const t0 = Date.now();
  let text: string;
  try {
    text = await transcribe({
      apiKey,
      model: profile.model,
      systemInstruction: profile.systemInstruction,
      wavPath: state.wavPath,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", `Transcription failed (profile=${profile.name}, model=${profile.model}): ${msg}`);
    appendHistory({
      ts: new Date().toISOString(),
      model: profile.model,
      text: "",
      durationMs: Date.now() - t0,
      audioBytes,
      error: msg,
      profileId: profile.id,
      profileName: profile.name,
    });
    writeUiState("idle", { error: msg });
    throw err;
  } finally {
    AudioRecorder.cleanup(state.wavPath);
  }

  const durationMs = Date.now() - t0;
  log("info", `Transcribed (profile=${profile.name}, model=${profile.model}, ${audioBytes}B, ${durationMs}ms, ${text.length} chars)`);
  appendHistory({
    ts: new Date().toISOString(),
    model: profile.model,
    text,
    durationMs,
    audioBytes,
    profileId: profile.id,
    profileName: profile.name,
  });

  if (copy) writeClipboard(text);

  let pasteResult: "fired" | "skipped" | "unavailable" = "skipped";
  if (paste && profile.autoPaste) {
    // Give the clipboard tool a beat to actually own the selection before we
    // fire Ctrl+V (writeClipboard returns immediately now, without waiting).
    await sleep(80);
    pasteResult = firePaste() ? "fired" : "unavailable";
  }

  writeUiState("idle", { text });
  return { text, durationMs, audioBytes, paste: pasteResult };
}

function profileById(id: string | undefined): Profile | null {
  if (!id) return null;
  const all = listProfiles().profiles;
  return all.find((p) => p.id === id) ?? null;
}

export function cancelRecording(): boolean {
  const state = readLock();
  if (!state) return false;
  cleanupAfterStop(state.pid, state.wavPath, true);
  writeUiState("idle");
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
