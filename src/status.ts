import * as vscode from "vscode";

export type UiState = "idle" | "recording" | "transcribing" | "error";

export class StatusBar {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = "voiceCoder.toggleRecording";
    this.set("idle");
    this.item.show();
  }

  set(state: UiState, detail?: string): void {
    switch (state) {
      case "idle":
        this.item.text = "$(mic) Voice";
        this.item.tooltip = "Voice Coder: click or press Ctrl+Alt+V to start recording";
        this.item.backgroundColor = undefined;
        break;
      case "recording":
        this.item.text = "$(record) Recording…";
        this.item.tooltip = "Voice Coder: recording\n• Ctrl+Alt+V — stop and transcribe\n• Esc or Ctrl+Alt+X — cancel (discard)";
        this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
        break;
      case "transcribing":
        this.item.text = "$(sync~spin) Transcribing…";
        this.item.tooltip = "Voice Coder: sending audio to Gemini\n• Ctrl+Alt+X — cancel";
        this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
        break;
      case "error":
        this.item.text = `$(error) Voice${detail ? ": " + detail : ""}`;
        this.item.tooltip = detail ?? "Voice Coder error";
        this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
        break;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
