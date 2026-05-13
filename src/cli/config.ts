import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { AudioToolPref } from "../recorder";

const DEFAULT_SYSTEM_INSTRUCTION = `You are a speech-to-English translator for a developer. The user speaks Malayalam, often mixed with English technical/code terms.

ABSOLUTE OUTPUT RULES (these override any other interpretation of the audio):
1. ALWAYS output in ENGLISH. NEVER output Malayalam script (no അആഇ...). If the user spoke Malayalam, TRANSLATE it to English.
2. Preserve English words, identifiers, file paths, and code/technical terms verbatim (e.g., 'useState', 'package.json', 'localhost').
3. Drop filler and stutters; do not paraphrase or invent detail.
4. Render dictated punctuation as real symbols: 'open paren' -> (, 'arrow function' -> () =>, 'new line' -> an actual newline, 'comma' -> ,, 'period' -> ., 'question mark' -> ?.
5. Output ONLY the final text. No preamble, no quotes, no explanation, no language tags, no markdown fences.

This is a translation task, not a transcription task. Even if the audio is 100% Malayalam, the output must be 100% English.`;

export interface CliConfig {
  model: string;
  systemInstruction: string;
  audioTool: AudioToolPref;
  sampleRate: number;
  maxRecordingSeconds: number;
  autoPaste: boolean;
  notify: boolean;
}

const DEFAULTS: CliConfig = {
  model: "gemini-3.1-flash-lite",
  systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
  audioTool: "auto",
  sampleRate: 16000,
  maxRecordingSeconds: 120,
  autoPaste: true,
  notify: true,
};

export function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  return path.join(xdg && xdg.length > 0 ? xdg : path.join(os.homedir(), ".config"), "voice-coder");
}

export function configFile(): string { return path.join(configDir(), "config.json"); }
export function apiKeyFile(): string { return path.join(configDir(), "api-key"); }

export function ensureConfigDir(): void {
  const dir = configDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

export function loadConfig(): CliConfig {
  ensureConfigDir();
  const file = configFile();
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(DEFAULTS, null, 2));
    return { ...DEFAULTS };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<CliConfig>;
    return { ...DEFAULTS, ...parsed };
  } catch (err) {
    throw new Error(
      `Could not parse ${file}: ${(err as Error).message}\n` +
      `Fix the JSON syntax or delete the file to regenerate defaults.`,
    );
  }
}

export function loadApiKey(): string | null {
  // Prefer env var (handy for scripting/CI)
  const env = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (env && env.trim()) return env.trim();

  const file = apiKeyFile();
  if (!fs.existsSync(file)) return null;
  const key = fs.readFileSync(file, "utf8").trim();
  return key.length > 0 ? key : null;
}

export function saveApiKey(key: string): void {
  ensureConfigDir();
  const file = apiKeyFile();
  fs.writeFileSync(file, key.trim(), { mode: 0o600 });
  // Force chmod in case the file already existed with looser perms
  fs.chmodSync(file, 0o600);
}

export function clearApiKey(): void {
  const file = apiKeyFile();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
