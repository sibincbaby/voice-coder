// Pure audio-analysis helpers (no I/O), so they can be unit-tested directly.

export interface WavLevel {
  peak: number; // max absolute 16-bit sample amplitude (0..32767)
  rms: number; // root-mean-square amplitude
  samples: number; // number of PCM samples analysed
}

/**
 * Measure peak + RMS amplitude of a 16-bit PCM mono WAV held in a Buffer.
 * Locates the `data` chunk rather than assuming a fixed 44-byte header.
 */
export function wavLevel(buf: Buffer): WavLevel {
  let off = 12;
  let dataOff = -1;
  let dataLen = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "data") {
      dataOff = off + 8;
      dataLen = size;
      break;
    }
    off += 8 + size + (size & 1);
  }
  if (dataOff < 0) {
    dataOff = 44;
    dataLen = buf.length - 44;
  }
  dataLen = Math.max(0, Math.min(dataLen, buf.length - dataOff));
  const n = Math.floor(dataLen / 2);
  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const s = buf.readInt16LE(dataOff + i * 2);
    const a = s < 0 ? -s : s;
    if (a > peak) peak = a;
    sumSq += s * s;
  }
  return { peak, rms: n ? Math.sqrt(sumSq / n) : 0, samples: n };
}

// Peak 16-bit amplitude below which a recording counts as "no speech".
// Full scale is 32767; room tone / muted mic peaks in the low hundreds,
// real speech in the thousands. 500 (~1.5% FS) separates them reliably.
export const DEFAULT_SILENCE_PEAK = 500;

/** Resolve the silence threshold, allowing a VOICE_CODER_SILENCE_PEAK override. */
export function silencePeakThreshold(): number {
  const raw = process.env.VOICE_CODER_SILENCE_PEAK;
  const v = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_SILENCE_PEAK;
}

/** True when the audio buffer has no speech-level energy. */
export function isSilent(buf: Buffer, threshold = silencePeakThreshold()): boolean {
  return wavLevel(buf).peak < threshold;
}

/** Build a minimal 16-bit PCM mono WAV from raw int16 samples (used in tests/tools). */
export function encodeWav(samples: Int16Array, sampleRate = 16000): Buffer {
  const dataLen = samples.length * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(samples[i], 44 + i * 2);
  return buf;
}
