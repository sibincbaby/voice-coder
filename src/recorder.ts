import { spawn, ChildProcess, execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

export type AudioTool = "arecord" | "sox" | "ffmpeg";
export type AudioToolPref = "auto" | AudioTool;

export class AudioRecorder {
  private proc: ChildProcess | null = null;
  private outputPath: string | null = null;
  private autoStopTimer: NodeJS.Timeout | null = null;
  private stopReason: "user" | "timeout" | "error" | null = null;

  constructor(
    private readonly tool: AudioTool,
    private readonly sampleRate: number,
  ) {}

  static detect(preference: AudioToolPref): AudioTool {
    if (preference !== "auto") {
      if (!AudioRecorder.isAvailable(preference)) {
        throw new Error(
          `Configured audio tool '${preference}' is not on PATH. Install it or set voiceCoder.audioTool to 'auto'.`,
        );
      }
      return preference;
    }
    for (const tool of ["arecord", "sox", "ffmpeg"] as AudioTool[]) {
      if (AudioRecorder.isAvailable(tool)) return tool;
    }
    throw new Error(
      "No audio recorder found. Install one of: arecord (sudo apt install alsa-utils), sox, or ffmpeg.",
    );
  }

  private static isAvailable(tool: AudioTool): boolean {
    try {
      execSync(`command -v ${tool}`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  async start(maxSeconds: number): Promise<void> {
    if (this.proc) throw new Error("Recorder already started");
    const file = `voice-coder-${randomUUID()}.wav`;
    this.outputPath = path.join(os.tmpdir(), file);
    this.stopReason = null;

    const { cmd, args } = this.buildCommand(this.outputPath);
    this.proc = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });

    let stderrTail = "";
    this.proc.stderr?.on("data", (chunk) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-2000);
    });
    this.proc.on("error", (err) => {
      this.stopReason = "error";
      console.error(`[voice-coder] recorder spawn error:`, err, stderrTail);
    });

    this.autoStopTimer = setTimeout(() => {
      this.stopReason = "timeout";
      this.kill();
    }, maxSeconds * 1000);
  }

  private buildCommand(outPath: string): { cmd: string; args: string[] } {
    const sr = String(this.sampleRate);
    switch (this.tool) {
      case "arecord":
        return {
          cmd: "arecord",
          args: ["-q", "-f", "S16_LE", "-r", sr, "-c", "1", "-t", "wav", outPath],
        };
      case "sox":
        return {
          cmd: "sox",
          args: ["-q", "-d", "-r", sr, "-c", "1", "-b", "16", outPath],
        };
      case "ffmpeg":
        return {
          cmd: "ffmpeg",
          args: [
            "-loglevel", "error",
            "-f", "alsa", "-i", "default",
            "-ar", sr, "-ac", "1",
            "-y", outPath,
          ],
        };
    }
  }

  async stop(): Promise<{ path: string; reason: "user" | "timeout" }> {
    if (!this.proc || !this.outputPath) {
      throw new Error("Recorder not started");
    }
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }
    const reason = this.stopReason === "timeout" ? "timeout" : "user";
    if (this.stopReason !== "timeout") this.stopReason = "user";

    const proc = this.proc;
    await new Promise<void>((resolve) => {
      const onExit = () => resolve();
      proc.once("exit", onExit);
      this.kill();
      setTimeout(() => {
        if (!proc.killed) proc.kill("SIGKILL");
        resolve();
      }, 1500);
    });

    const finalPath = this.outputPath;
    this.proc = null;
    this.outputPath = null;

    if (!fs.existsSync(finalPath) || fs.statSync(finalPath).size < 1024) {
      throw new Error(
        "Recording produced no audio. Check your microphone permissions and default input device.",
      );
    }
    return { path: finalPath, reason };
  }

  private kill() {
    if (!this.proc) return;
    // SIGINT triggers graceful WAV finalization for arecord, sox, and ffmpeg
    try { this.proc.kill("SIGINT"); } catch { /* noop */ }
  }

  static cleanup(filePath: string): void {
    try { fs.unlinkSync(filePath); } catch { /* noop */ }
  }
}
