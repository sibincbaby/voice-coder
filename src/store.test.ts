import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { appendHistory, readHistory, clearHistory, log, readLogLines, clearLogs } from "./store";

let tmp: string;
const origEnv = { ...process.env };

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vc-store-test-"));
  process.env.XDG_CONFIG_HOME = tmp;
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  process.env = { ...origEnv };
});

function entry(text: string) {
  return { ts: new Date(0).toISOString(), model: "m", text, durationMs: 1, audioBytes: 1 };
}

describe("history", () => {
  it("returns empty before anything is written", () => {
    expect(readHistory()).toEqual([]);
  });

  it("appends and reads back newest-first", () => {
    appendHistory(entry("first"));
    appendHistory(entry("second"));
    const h = readHistory();
    expect(h.map((e) => e.text)).toEqual(["second", "first"]);
  });

  it("trims to the most recent 500 entries", () => {
    for (let i = 0; i < 530; i++) appendHistory(entry(`e${i}`));
    const h = readHistory(1000);
    expect(h.length).toBe(500);
    // newest first, so e529 is first and e29 is the oldest kept
    expect(h[0].text).toBe("e529");
    expect(h[h.length - 1].text).toBe("e30");
  });

  it("skips malformed lines without throwing", () => {
    appendHistory(entry("good"));
    const file = path.join(tmp, "voice-coder", "history.jsonl");
    fs.appendFileSync(file, "{ broken\n");
    expect(readHistory().map((e) => e.text)).toEqual(["good"]);
  });

  it("clears history", () => {
    appendHistory(entry("x"));
    clearHistory();
    expect(readHistory()).toEqual([]);
  });
});

describe("logs", () => {
  it("writes and tails log lines", () => {
    log("info", "hello");
    log("warn", "careful");
    const lines = readLogLines();
    expect(lines.some((l) => l.includes("[info] hello"))).toBe(true);
    expect(lines.some((l) => l.includes("[warn] careful"))).toBe(true);
  });

  it("clears logs", () => {
    log("info", "x");
    clearLogs();
    expect(readLogLines()).toEqual([]);
  });
});
