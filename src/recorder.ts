import * as fs from "node:fs";
import { isExecutableOnPath } from "./which";

export type AudioTool = "arecord" | "sox" | "ffmpeg";
export type AudioToolPref = "auto" | AudioTool;

/**
 * Build the recorder command to capture 16-bit mono PCM WAV to `outPath`.
 * Shared by AudioRecorder (the VS Code path) and the CLI session, which spawns
 * its own detached recorder — keep this the single source of truth.
 */
export function buildRecorderCommand(
  tool: AudioTool,
  sampleRate: number,
  outPath: string,
): { bin: string; args: string[] } {
  const sr = String(sampleRate);
  switch (tool) {
    case "arecord":
      return {
        bin: "arecord",
        args: ["-q", "-f", "S16_LE", "-r", sr, "-c", "1", "-t", "wav", outPath],
      };
    case "sox":
      return { bin: "sox", args: ["-q", "-d", "-r", sr, "-c", "1", "-b", "16", outPath] };
    case "ffmpeg":
      return {
        bin: "ffmpeg",
        args: [
          "-loglevel",
          "error",
          "-f",
          "alsa",
          "-i",
          "default",
          "-ar",
          sr,
          "-ac",
          "1",
          "-y",
          outPath,
        ],
      };
  }
}

export class AudioRecorder {
  static detect(preference: AudioToolPref): AudioTool {
    if (preference !== "auto") {
      if (!isExecutableOnPath(preference)) {
        throw new Error(
          `Configured audio tool '${preference}' is not on PATH. Install it or set audioTool to 'auto'.`,
        );
      }
      return preference;
    }
    for (const tool of ["arecord", "sox", "ffmpeg"] as AudioTool[]) {
      if (isExecutableOnPath(tool)) return tool;
    }
    throw new Error(
      "No audio recorder found. Install one of: arecord (sudo apt install alsa-utils), sox, or ffmpeg.",
    );
  }

  static cleanup(filePath: string): void {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* noop */
    }
  }
}
