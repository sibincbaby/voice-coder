import * as fs from "node:fs";
import * as path from "node:path";
import { configDir, ensureConfigDir } from "./config";

const MAX_HISTORY_ENTRIES = 500;
const MAX_LOG_BYTES = 1_000_000; // ~1 MB before rotation

export interface HistoryEntry {
  ts: string;            // ISO 8601
  model: string;
  text: string;
  durationMs: number;    // wall-clock for the Gemini call
  audioBytes: number;
  error?: string;
  profileId?: string;
  profileName?: string;
}

function historyFile(): string { return path.join(configDir(), "history.jsonl"); }
function logFile(): string     { return path.join(configDir(), "voice-coder.log"); }
function logOldFile(): string  { return path.join(configDir(), "voice-coder.log.1"); }

// ----------------- history -----------------

export function appendHistory(entry: HistoryEntry): void {
  ensureConfigDir();
  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(historyFile(), line);
  rotateHistoryIfNeeded();
}

export function readHistory(limit = 200): HistoryEntry[] {
  ensureConfigDir();
  const f = historyFile();
  if (!fs.existsSync(f)) return [];
  // Read full file (we cap entries at 500) and parse JSONL
  const lines = fs.readFileSync(f, "utf8").split("\n").filter((l) => l.length > 0);
  const out: HistoryEntry[] = [];
  // Take the last `limit` lines from the end
  for (let i = Math.max(0, lines.length - limit); i < lines.length; i++) {
    try { out.push(JSON.parse(lines[i]) as HistoryEntry); } catch { /* skip malformed */ }
  }
  return out.reverse(); // newest first
}

export function clearHistory(): void {
  const f = historyFile();
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

function rotateHistoryIfNeeded(): void {
  const f = historyFile();
  if (!fs.existsSync(f)) return;
  const lines = fs.readFileSync(f, "utf8").split("\n").filter((l) => l.length > 0);
  if (lines.length <= MAX_HISTORY_ENTRIES) return;
  // Keep only the newest MAX entries
  const trimmed = lines.slice(-MAX_HISTORY_ENTRIES).join("\n") + "\n";
  fs.writeFileSync(f, trimmed);
}

// ----------------- logger -----------------

export type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, msg: string): void {
  ensureConfigDir();
  const line = `${new Date().toISOString()} [${level}] ${msg}\n`;
  try {
    fs.appendFileSync(logFile(), line);
    rotateLogIfNeeded();
  } catch { /* logging must never throw */ }
  if (level === "error") {
    process.stderr.write(line);
  }
}

export function readLogLines(maxLines = 500): string[] {
  const f = logFile();
  if (!fs.existsSync(f)) return [];
  const content = fs.readFileSync(f, "utf8");
  const lines = content.split("\n").filter((l) => l.length > 0);
  return lines.slice(-maxLines);
}

export function clearLogs(): void {
  for (const f of [logFile(), logOldFile()]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

function rotateLogIfNeeded(): void {
  const f = logFile();
  if (!fs.existsSync(f)) return;
  if (fs.statSync(f).size < MAX_LOG_BYTES) return;
  // Move current → .1 (overwriting any older .1), start a fresh log
  try {
    fs.renameSync(f, logOldFile());
  } catch { /* best effort */ }
}
