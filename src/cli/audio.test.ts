import { describe, it, expect, afterEach } from "vitest";
import { wavLevel, isSilent, silencePeakThreshold, encodeWav, DEFAULT_SILENCE_PEAK } from "./audio";

function tone(amplitude: number, samples = 16000): Int16Array {
  const out = new Int16Array(samples);
  for (let i = 0; i < samples; i++) out[i] = Math.round(Math.sin(i / 5) * amplitude);
  return out;
}

describe("wavLevel", () => {
  it("reports zero for pure silence", () => {
    const buf = encodeWav(new Int16Array(8000));
    const lvl = wavLevel(buf);
    expect(lvl.peak).toBe(0);
    expect(lvl.rms).toBe(0);
    expect(lvl.samples).toBe(8000);
  });

  it("reports the true peak for a loud tone", () => {
    const buf = encodeWav(tone(8000));
    const lvl = wavLevel(buf);
    expect(lvl.peak).toBeGreaterThan(7900);
    expect(lvl.peak).toBeLessThanOrEqual(8000);
    expect(lvl.rms).toBeGreaterThan(0);
  });

  it("handles a buffer with no data chunk without throwing", () => {
    const lvl = wavLevel(Buffer.alloc(40));
    expect(lvl.samples).toBe(0);
    expect(lvl.peak).toBe(0);
  });
});

describe("isSilent", () => {
  it("treats pure silence as silent", () => {
    expect(isSilent(encodeWav(new Int16Array(4000)))).toBe(true);
  });

  it("treats a low room-tone hum as silent", () => {
    expect(isSilent(encodeWav(tone(200)))).toBe(true);
  });

  it("treats speech-level energy as not silent", () => {
    expect(isSilent(encodeWav(tone(4000)))).toBe(false);
  });

  it("respects an explicit threshold argument", () => {
    const buf = encodeWav(tone(300));
    expect(isSilent(buf, 100)).toBe(false);
    expect(isSilent(buf, 1000)).toBe(true);
  });
});

describe("silencePeakThreshold", () => {
  const orig = process.env.VOICE_CODER_SILENCE_PEAK;
  afterEach(() => {
    if (orig === undefined) delete process.env.VOICE_CODER_SILENCE_PEAK;
    else process.env.VOICE_CODER_SILENCE_PEAK = orig;
  });

  it("defaults when unset", () => {
    delete process.env.VOICE_CODER_SILENCE_PEAK;
    expect(silencePeakThreshold()).toBe(DEFAULT_SILENCE_PEAK);
  });

  it("honours a valid override", () => {
    process.env.VOICE_CODER_SILENCE_PEAK = "1234";
    expect(silencePeakThreshold()).toBe(1234);
  });

  it("falls back to default on garbage input", () => {
    process.env.VOICE_CODER_SILENCE_PEAK = "not-a-number";
    expect(silencePeakThreshold()).toBe(DEFAULT_SILENCE_PEAK);
  });
});
