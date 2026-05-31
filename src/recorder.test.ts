import { describe, it, expect } from "vitest";
import { buildRecorderCommand } from "./recorder";

describe("buildRecorderCommand", () => {
  it("builds an arecord command for 16-bit mono WAV", () => {
    const { bin, args } = buildRecorderCommand("arecord", 16000, "/tmp/out.wav");
    expect(bin).toBe("arecord");
    expect(args).toContain("S16_LE");
    expect(args).toContain("16000");
    expect(args).toContain("/tmp/out.wav");
    expect(args).toContain("wav");
  });

  it("builds a sox command", () => {
    const { bin, args } = buildRecorderCommand("sox", 44100, "/tmp/o.wav");
    expect(bin).toBe("sox");
    expect(args).toContain("44100");
    expect(args.at(-1)).toBe("/tmp/o.wav");
  });

  it("builds an ffmpeg command capturing from alsa", () => {
    const { bin, args } = buildRecorderCommand("ffmpeg", 16000, "/tmp/o.wav");
    expect(bin).toBe("ffmpeg");
    expect(args).toContain("alsa");
    expect(args).toContain("-ac");
    expect(args.at(-1)).toBe("/tmp/o.wav");
  });

  it("passes the sample rate through as a string in all backends", () => {
    for (const tool of ["arecord", "sox", "ffmpeg"] as const) {
      const { args } = buildRecorderCommand(tool, 22050, "/x.wav");
      expect(args).toContain("22050");
    }
  });
});
