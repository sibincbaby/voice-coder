import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  loadConfig,
  saveConfig,
  loadApiKey,
  saveApiKey,
  clearApiKey,
  configFile,
  apiKeyFile,
} from "./config";

let tmp: string;
const origEnv = { ...process.env };

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vc-config-test-"));
  process.env.XDG_CONFIG_HOME = tmp;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  process.env = { ...origEnv };
});

describe("loadConfig", () => {
  it("writes and returns defaults on first run", () => {
    const cfg = loadConfig();
    expect(cfg.model).toMatch(/gemini/);
    expect(cfg.sampleRate).toBe(16000);
    expect(fs.existsSync(configFile())).toBe(true);
  });

  it("merges persisted values over defaults", () => {
    saveConfig({ model: "gemini-3-flash", sampleRate: 48000 });
    const cfg = loadConfig();
    expect(cfg.model).toBe("gemini-3-flash");
    expect(cfg.sampleRate).toBe(48000);
    expect(cfg.autoPaste).toBe(true); // untouched default
  });

  it("throws a helpful error on corrupt JSON", () => {
    loadConfig(); // ensure dir exists
    fs.writeFileSync(configFile(), "{ not valid json");
    expect(() => loadConfig()).toThrow(/Could not parse/);
  });
});

describe("saveConfig", () => {
  it("ignores unknown keys (whitelist)", () => {
    saveConfig({ model: "gemini-x", hacked: "value" } as never);
    const raw = JSON.parse(fs.readFileSync(configFile(), "utf8"));
    expect(raw.model).toBe("gemini-x");
    expect(raw.hacked).toBeUndefined();
  });
});

describe("api key storage", () => {
  it("returns null when unset", () => {
    expect(loadApiKey()).toBeNull();
  });

  it("saves with 0600 permissions and reads back", () => {
    saveApiKey("  secret-key-value  ");
    expect(loadApiKey()).toBe("secret-key-value");
    const mode = fs.statSync(apiKeyFile()).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("prefers the GEMINI_API_KEY env var over the file", () => {
    saveApiKey("file-key");
    process.env.GEMINI_API_KEY = "env-key";
    expect(loadApiKey()).toBe("env-key");
  });

  it("clears the stored key", () => {
    saveApiKey("k");
    clearApiKey();
    expect(loadApiKey()).toBeNull();
  });
});
