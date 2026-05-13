import { spawn, spawnSync } from "node:child_process";
import * as readline from "node:readline";

import { pasteToolName } from "./inject";
import {
  loadConfig, loadApiKey, saveApiKey, clearApiKey, configFile, apiKeyFile, configDir,
  type CliConfig,
} from "./config";
import {
  isRecording, startRecording, stopAndTranscribe, cancelRecording, getStatus,
} from "./session";

// ---------- main ----------

async function main(argv: string[]): Promise<number> {
  const [cmd = "toggle", ...rest] = argv;
  try {
    switch (cmd) {
      case "toggle": return await cmdToggle(rest);
      case "record": return cmdRecord();
      case "stop":   return await cmdStop(rest);
      case "cancel": return cmdCancel();
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
  if (isRecording()) return cmdStop(rest);
  return cmdRecord();
}

function cmdRecord(): number {
  const state = startRecording();
  notify("Voice Coder", "Recording — press the shortcut again to stop", "low");
  console.log(`Recording (pid=${state.pid}, wav=${state.wavPath})`);
  return 0;
}

async function cmdStop(rest: string[]): Promise<number> {
  const wantCopyOnly = rest.includes("--copy-only") || rest.includes("-c");
  notify("Voice Coder", "Transcribing…", "low");
  const result = await stopAndTranscribe({ paste: !wantCopyOnly });
  const { text, paste } = result;

  if (paste === "fired") {
    notify("Voice Coder", `✓ ${preview(text)}`, "low");
  } else if (paste === "unavailable") {
    notify(
      "Voice Coder",
      `Copied to clipboard (no paste tool — install xdotool/ydotool/wtype):\n${preview(text)}`,
      "normal",
    );
  } else {
    notify("Voice Coder", `Copied to clipboard:\n${preview(text)}`, "normal");
  }
  console.log(text);
  return 0;
}

function cmdCancel(): number {
  if (!cancelRecording()) {
    console.error("Not recording.");
    return 1;
  }
  notify("Voice Coder", "Recording cancelled", "low");
  console.log("Cancelled.");
  return 0;
}

function cmdStatus(): number {
  const s = getStatus();
  if (s.state === "idle") {
    console.log("idle");
    return 0;
  }
  const elapsedSec = Math.round((s.elapsedMs ?? 0) / 1000);
  console.log(`recording (pid=${s.pid}, ${elapsedSec}s elapsed, tool=${s.tool})`);
  return 0;
}

async function cmdSetKey(): Promise<number> {
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
  const appMode = rest.includes("--app");
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
  if (!noOpen) {
    if (appMode) openInAppMode(handle.url);
    else         openBrowser(handle.url);
  }

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

function openInAppMode(url: string): void {
  // Try Chrome / Chromium / Brave in --app= mode for a chromeless window
  // that feels native. If none are installed, fall back to xdg-open.
  const candidates = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "brave-browser"];
  for (const bin of candidates) {
    try {
      const out = spawnSync("command", ["-v", bin], { stdio: "ignore", shell: true });
      if (out.status === 0) {
        spawn(bin, [`--app=${url}`, "--new-window", "--no-first-run"], { stdio: "ignore", detached: true }).unref();
        return;
      }
    } catch { /* try next */ }
  }
  // Fallback
  console.log("(No Chrome/Chromium found for --app mode; opening default browser instead.)");
  openBrowser(url);
}

function cmdConfig(): number {
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
