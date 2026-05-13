import { spawn, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { randomUUID } from "node:crypto";
import * as readline from "node:readline";

import { AudioRecorder } from "../recorder";
import { transcribe } from "../transcriber";
import { writeClipboard, firePaste, pasteToolName } from "./inject";
import {
  loadConfig, loadApiKey, saveApiKey, clearApiKey, configFile, apiKeyFile, configDir,
  type CliConfig,
} from "./config";
import { appendHistory, log } from "./store";

const LOCKFILE = path.join(os.tmpdir(), `voice-coder-${process.env.USER ?? "user"}.lock`);

interface LockState {
  pid: number;
  wavPath: string;
  startedAt: number;
  tool: string;
}

// ---------- main ----------

async function main(argv: string[]): Promise<number> {
  const [cmd = "toggle", ...rest] = argv;
  try {
    switch (cmd) {
      case "toggle": return await cmdToggle(rest);
      case "record": return await cmdRecord();
      case "stop":   return await cmdStop(rest);
      case "cancel": return await cmdCancel();
      case "status": return cmdStatus();
      case "set-key": return await cmdSetKey();
      case "clear-key": return cmdClearKey();
      case "config": return cmdConfig();
      case "ui":
      case "dashboard": return await cmdUi(rest);
      case "help":
      case "-h":
      case "--help": return cmdHelp();
      default:
        console.error(`Unknown command: ${cmd}\n`);
        return cmdHelp();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`voice-coder: ${msg}`);
    notify("Voice Coder", msg, "critical");
    return 1;
  }
}

// ---------- commands ----------

async function cmdToggle(rest: string[]): Promise<number> {
  if (isRecording()) {
    return cmdStop(rest);
  }
  return cmdRecord();
}

async function cmdRecord(): Promise<number> {
  if (isRecording()) {
    console.error("Already recording. Run `voice-coder stop` or `voice-coder cancel`.");
    return 1;
  }
  const cfg = loadConfig();
  const tool = AudioRecorder.detect(cfg.audioTool);

  const wavPath = path.join(os.tmpdir(), `voice-coder-${randomUUID()}.wav`);
  const { bin, args } = buildRecorderCommand(tool, cfg.sampleRate, wavPath);

  // Detached so we can return immediately while arecord/sox/ffmpeg keeps going
  const proc = spawn(bin, args, { stdio: "ignore", detached: true });
  proc.unref();
  if (!proc.pid) throw new Error(`Failed to spawn ${bin}`);

  const state: LockState = { pid: proc.pid, wavPath, startedAt: Date.now(), tool };
  fs.writeFileSync(LOCKFILE, JSON.stringify(state));

  notify("Voice Coder", "Recording — press the shortcut again to stop", "low");
  log("info", `Started recording (pid=${proc.pid}, tool=${tool}, wav=${wavPath})`);
  console.log(`Recording (pid=${proc.pid}, wav=${wavPath})`);

  // Schedule a self-stop if no one calls stop within maxRecordingSeconds.
  // We can't sit and wait because we want this process to exit, so we spawn
  // a tiny watcher: a `sh -c` that sleeps, then signals the recorder.
  scheduleWatchdog(proc.pid, cfg.maxRecordingSeconds);
  return 0;
}

async function cmdStop(rest: string[]): Promise<number> {
  const wantCopyOnly = rest.includes("--copy-only") || rest.includes("-c");
  const state = readLock();
  if (!state) {
    console.error("Not recording.");
    return 1;
  }
  const cfg = loadConfig();
  const apiKey = loadApiKey();
  if (!apiKey) {
    cleanupAfterStop(state.pid, state.wavPath, true);
    throw new Error("No Gemini API key. Run `voice-coder set-key` first.");
  }

  // Tell the recorder to wrap up
  try { process.kill(state.pid, "SIGINT"); } catch { /* already gone */ }
  await waitForExit(state.pid, 3000);
  fs.rmSync(LOCKFILE, { force: true });

  if (!fs.existsSync(state.wavPath) || fs.statSync(state.wavPath).size < 1024) {
    AudioRecorder.cleanup(state.wavPath);
    throw new Error("Recording produced no audio (check your default mic).");
  }

  notify("Voice Coder", "Transcribing…", "low");
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

  writeClipboard(text);

  const autoPaste = cfg.autoPaste && !wantCopyOnly;
  if (autoPaste) {
    const fired = firePaste();
    if (!fired) {
      notify(
        "Voice Coder",
        `Copied to clipboard (no paste tool — install xdotool/ydotool/wtype):\n${preview(text)}`,
        "normal",
      );
    } else {
      notify("Voice Coder", `✓ ${preview(text)}`, "low");
    }
  } else {
    notify("Voice Coder", `Copied to clipboard:\n${preview(text)}`, "normal");
  }
  console.log(text);
  return 0;
}

async function cmdCancel(): Promise<number> {
  const state = readLock();
  if (!state) {
    console.error("Not recording.");
    return 1;
  }
  cleanupAfterStop(state.pid, state.wavPath, true);
  log("info", `Recording cancelled by user`);
  notify("Voice Coder", "Recording cancelled", "low");
  console.log("Cancelled.");
  return 0;
}

function cmdStatus(): number {
  const state = readLock();
  if (!state) {
    console.log("idle");
    return 0;
  }
  const elapsed = Math.round((Date.now() - state.startedAt) / 1000);
  console.log(`recording (pid=${state.pid}, ${elapsed}s elapsed, tool=${state.tool})`);
  return 0;
}

async function cmdSetKey(): Promise<number> {
  // Try to read from a TTY; if there isn't one, accept from stdin
  const key = process.stdin.isTTY ? await promptPassword("Gemini API key: ") : await readAllStdin();
  if (!key.trim()) {
    console.error("No key entered.");
    return 1;
  }
  saveApiKey(key.trim());
  console.log(`Saved to ${apiKeyFile()} (chmod 600).`);
  notify("Voice Coder", "API key saved", "low");
  return 0;
}

function cmdClearKey(): number {
  clearApiKey();
  console.log("Cleared.");
  return 0;
}

async function cmdUi(rest: string[]): Promise<number> {
  const { startServer } = await import("./server");
  const portArg = parseArg(rest, "--port");
  const noOpen = rest.includes("--no-open");
  const port = portArg ? parseInt(portArg, 10) : 7777;

  const handle = await startServer({ port }).catch((err) => {
    if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
      throw new Error(`Port ${port} is already in use. Try: voice-coder ui --port 7778`);
    }
    throw err;
  });

  console.log(`Voice Coder UI running at ${handle.url}`);
  console.log(`Press Ctrl+C to stop.`);
  notify("Voice Coder", `UI: ${handle.url}`, "low");
  if (!noOpen) openBrowser(handle.url);

  // Keep alive until SIGINT
  return new Promise<number>((resolve) => {
    const shutdown = () => {
      console.log("\nShutting down…");
      handle.close().finally(() => resolve(0));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
}

function parseArg(rest: string[], name: string): string | null {
  const idx = rest.indexOf(name);
  if (idx === -1 || idx === rest.length - 1) return null;
  return rest[idx + 1];
}

function openBrowser(url: string): void {
  spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
}

function cmdConfig(): number {
  // Print resolved paths and current effective config
  const cfg = loadConfig();
  console.log(`config file: ${configFile()}`);
  console.log(`api key file: ${apiKeyFile()} (${loadApiKey() ? "set" : "unset"})`);
  console.log(`paste tool: ${pasteToolName()}`);
  console.log();
  console.log(JSON.stringify(cfg, null, 2));
  return 0;
}

function cmdHelp(): number {
  console.log(`voice-coder — Gemini-powered voice typing for Linux

Usage:
  voice-coder <command>

Commands:
  toggle              Start recording, or stop and transcribe (default)
  record              Start recording
  stop [--copy-only]  Stop recording and transcribe. --copy-only skips auto-paste
  cancel              Discard active recording
  status              Print idle / recording state
  set-key             Read a Gemini API key from stdin and store it (chmod 600)
  clear-key           Delete the stored API key
  config              Print effective config and config file paths
  ui [--port N]       Open the web dashboard (default http://localhost:7777)
  help                This text

Typical setup:
  1. voice-coder set-key                   # one-time, paste your key
  2. Bind 'voice-coder toggle' to a global keyboard shortcut in your DE
     (GNOME: Settings -> Keyboard -> Custom Shortcuts. Pick e.g. Ctrl+Alt+V)
  3. Focus an input anywhere, press the shortcut, speak, press it again.

Config:  ${configDir()}/config.json
`);
  return 0;
}

// ---------- helpers ----------

function isRecording(): boolean { return readLock() !== null; }

function readLock(): LockState | null {
  if (!fs.existsSync(LOCKFILE)) return null;
  try {
    const state = JSON.parse(fs.readFileSync(LOCKFILE, "utf8")) as LockState;
    // Stale lockfile (process is gone) — clean it up
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

function buildRecorderCommand(tool: string, sr: number, out: string): { bin: string; args: string[] } {
  const r = String(sr);
  switch (tool) {
    case "arecord":
      return { bin: "arecord", args: ["-q", "-f", "S16_LE", "-r", r, "-c", "1", "-t", "wav", out] };
    case "sox":
      return { bin: "sox", args: ["-q", "-d", "-r", r, "-c", "1", "-b", "16", out] };
    case "ffmpeg":
      return { bin: "ffmpeg", args: ["-loglevel", "error", "-f", "alsa", "-i", "default", "-ar", r, "-ac", "1", "-y", out] };
    default:
      throw new Error(`Unknown recorder tool: ${tool}`);
  }
}

function scheduleWatchdog(pid: number, maxSeconds: number): void {
  // Detached `sh` that sleeps then SIGINTs the recorder. Survives this
  // process exiting. Does nothing if the recorder has already stopped.
  const script = `sleep ${maxSeconds}; kill -INT ${pid} 2>/dev/null; true`;
  const w = spawn("sh", ["-c", script], { stdio: "ignore", detached: true });
  w.unref();
}

async function waitForExit(pid: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { process.kill(pid, 0); } catch { return; }
    await sleep(50);
  }
}

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

function preview(s: string): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > 120 ? oneLine.slice(0, 120) + "…" : oneLine;
}

function notify(title: string, body: string, urgency: "low" | "normal" | "critical" = "normal"): void {
  const cfg = safeLoadConfigForNotify();
  if (cfg && !cfg.notify) return;
  spawnSync("notify-send", ["--app-name=voice-coder", `--urgency=${urgency}`, "--expire-time=4000", title, body], {
    stdio: "ignore",
  });
}

function safeLoadConfigForNotify(): CliConfig | null {
  try { return loadConfig(); } catch { return null; }
}

function promptPassword(label: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  // Mute echo: re-render the prompt and swallow keypress output
  return new Promise((resolve) => {
    process.stdout.write(label);
    let buf = "";
    const onData = (chunk: Buffer) => {
      const s = chunk.toString("utf8");
      for (const ch of s) {
        if (ch === "\n" || ch === "\r") {
          process.stdin.removeListener("data", onData);
          process.stdin.pause();
          process.stdout.write("\n");
          rl.close();
          resolve(buf);
          return;
        }
        if (ch === "\x03") { // Ctrl-C
          process.stdout.write("\n");
          process.exit(130);
        }
        if (ch === "\x7f" || ch === "\b") {
          if (buf.length > 0) buf = buf.slice(0, -1);
        } else {
          buf += ch;
        }
      }
    };
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

function readAllStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => { buf += chunk; });
    process.stdin.on("end", () => resolve(buf));
    process.stdin.on("error", reject);
  });
}

// ---------- entrypoint ----------

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => { console.error(err); process.exit(1); },
);
