import * as vscode from "vscode";
import { AudioRecorder } from "./recorder";
import { transcribe } from "./transcriber";
import { injectText } from "./injector";
import { readConfig, promptForApiKey, clearApiKey } from "./config";
import { StatusBar } from "./status";

type State = "idle" | "recording" | "transcribing";

let state: State = "idle";
let recorder: AudioRecorder | null = null;
let abortController: AbortController | null = null;
let statusBar: StatusBar | null = null;

function setState(next: State): void {
  state = next;
  // Drives the 'when: voiceCoder.recording' Escape keybinding
  void vscode.commands.executeCommand("setContext", "voiceCoder.recording", next === "recording");
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  statusBar = new StatusBar();
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand("voiceCoder.toggleRecording", () =>
      toggleRecording(context).catch((err) => handleError(err)),
    ),
    vscode.commands.registerCommand("voiceCoder.cancelRecording", () =>
      cancelRecording().catch((err) => handleError(err)),
    ),
    vscode.commands.registerCommand("voiceCoder.setApiKey", async () => {
      const key = await promptForApiKey(context);
      if (key) {
        void vscode.window.showInformationMessage("Voice Coder: Gemini API key saved.");
      }
    }),
    vscode.commands.registerCommand("voiceCoder.clearApiKey", async () => {
      await clearApiKey(context);
      void vscode.window.showInformationMessage("Voice Coder: Gemini API key cleared.");
    }),
    vscode.commands.registerCommand("voiceCoder.openSettings", () => {
      void vscode.commands.executeCommand("workbench.action.openSettings", "voiceCoder");
    }),
  );
}

export function deactivate(): void {
  abortController?.abort();
  if (recorder) {
    // best-effort cleanup; we can't await in deactivate
    recorder.stop().catch(() => { /* noop */ });
  }
  statusBar?.dispose();
}

async function toggleRecording(context: vscode.ExtensionContext): Promise<void> {
  if (state === "transcribing") {
    // Cancel in-flight transcription
    abortController?.abort();
    return;
  }
  if (state === "recording") {
    await stopAndTranscribe(context);
    return;
  }
  await startRecording(context);
}

async function startRecording(context: vscode.ExtensionContext): Promise<void> {
  let cfg = await readConfig(context);
  if (!cfg) {
    const key = await promptForApiKey(context);
    if (!key) {
      void vscode.window.showWarningMessage("Voice Coder: a Gemini API key is required.");
      return;
    }
    cfg = await readConfig(context);
    if (!cfg) return;
  }

  let tool;
  try {
    tool = AudioRecorder.detect(cfg.audioTool);
  } catch (err) {
    handleError(err);
    return;
  }

  recorder = new AudioRecorder(tool, cfg.sampleRate);
  try {
    await recorder.start(cfg.maxRecordingSeconds);
  } catch (err) {
    recorder = null;
    handleError(err);
    return;
  }
  setState("recording");
  statusBar?.set("recording");
}

async function cancelRecording(): Promise<void> {
  if (state === "idle") return;

  if (state === "transcribing") {
    abortController?.abort();
    void vscode.window.setStatusBarMessage("Voice Coder: cancelling transcription…", 2000);
    return;
  }

  // state === "recording" — discard audio, never call Gemini
  const r = recorder;
  recorder = null;
  setState("idle");
  statusBar?.set("idle");
  if (!r) return;
  try {
    const { path } = await r.stop();
    AudioRecorder.cleanup(path);
  } catch { /* recorder was already torn down */ }
  void vscode.window.setStatusBarMessage("Voice Coder: recording cancelled.", 2000);
}

async function stopAndTranscribe(context: vscode.ExtensionContext): Promise<void> {
  if (!recorder) {
    setState("idle");
    statusBar?.set("idle");
    return;
  }

  setState("transcribing");
  statusBar?.set("transcribing");

  let wavPath: string | null = null;
  try {
    const { path } = await recorder.stop();
    wavPath = path;
  } catch (err) {
    recorder = null;
    setState("idle");
    handleError(err);
    return;
  }
  recorder = null;

  const cfg = await readConfig(context);
  if (!cfg) {
    setState("idle");
    statusBar?.set("idle");
    if (wavPath) AudioRecorder.cleanup(wavPath);
    return;
  }

  abortController = new AbortController();
  try {
    const text = await transcribe({
      apiKey: cfg.apiKey,
      model: cfg.model,
      systemInstruction: cfg.systemInstruction,
      wavPath,
      signal: abortController.signal,
    });

    await injectText(text, {
      method: cfg.injectionMethod,
      restoreClipboard: cfg.restoreClipboard,
    });

    setState("idle");
    statusBar?.set("idle");

    // Brief feedback: confirm what was transcribed and that it's in the clipboard
    const preview = text.length > 60 ? text.slice(0, 60) + "…" : text;
    const focused = vscode.window.state.focused;
    const msg = focused
      ? `Voice Coder: ✓ ${preview}`
      : `Voice Coder: clipboard ↓ ${preview} (VS Code wasn't focused — Ctrl+V to paste)`;
    void vscode.window.setStatusBarMessage(msg, focused ? 3000 : 8000);
  } catch (err) {
    setState("idle");
    // Abort is an expected cancellation — don't surface it as an error toast
    if (isAbortError(err)) {
      statusBar?.set("idle");
      void vscode.window.setStatusBarMessage("Voice Coder: transcription cancelled.", 2000);
    } else {
      handleError(err);
    }
  } finally {
    abortController = null;
    if (wavPath) AudioRecorder.cleanup(wavPath);
  }
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name;
  return name === "AbortError" || name === "DOMException" || name === "ApiError";
}

function handleError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[voice-coder]", err);
  statusBar?.set("error", msg.slice(0, 60));
  void vscode.window.showErrorMessage(`Voice Coder: ${msg}`);
  setTimeout(() => {
    if (state === "idle") statusBar?.set("idle");
  }, 4000);
}
