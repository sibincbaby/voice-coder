import * as vscode from "vscode";
import { spawn, execSync } from "node:child_process";

export type InjectionMethod = "clipboard-paste" | "type-command";

export interface InjectOptions {
  method: InjectionMethod;
  restoreClipboard: boolean;
}

export async function injectText(text: string, opts: InjectOptions): Promise<void> {
  if (opts.method === "type-command") {
    // Only works in the focused editor — not in webviews (Copilot Chat) or terminals.
    await vscode.commands.executeCommand("default:type", { text });
    return;
  }
  await clipboardPaste(text, opts.restoreClipboard);
}

async function clipboardPaste(text: string, restore: boolean): Promise<void> {
  const previous = restore ? await safeReadClipboard() : null;
  await vscode.env.clipboard.writeText(text);
  await sleep(40);

  // Don't fire OS-level Ctrl+V if VS Code isn't the focused window — the
  // keystroke would land in whatever app the user clicked into. The transcript
  // is already in the clipboard, so they can paste it manually whenever.
  if (!vscode.window.state.focused) {
    return;
  }

  const osTool = detectOsTool();
  if (osTool !== "none") {
    // Preferred path: a system-level Ctrl+V works in editor, Copilot Chat
    // webview, integrated terminal, search box, command palette — everywhere
    // VS Code can hold keyboard focus.
    await osLevelPaste(osTool);
  } else {
    // Fallback: VS Code's built-in paste. Works in editors and some widgets;
    // silently does nothing in webviews and terminals.
    await vscodePasteFallback();
  }

  if (restore && previous !== null) {
    setTimeout(() => {
      vscode.env.clipboard.writeText(previous).then(undefined, () => { /* noop */ });
    }, 400);
  }
}

type OsTool = "xdotool" | "ydotool" | "wtype" | "none";
let osToolCache: OsTool | null = null;
let warnedNoTool = false;

function detectOsTool(): OsTool {
  if (osToolCache) return osToolCache;
  for (const t of ["xdotool", "ydotool", "wtype"] as const) {
    try {
      execSync(`command -v ${t}`, { stdio: "ignore" });
      osToolCache = t;
      return t;
    } catch { /* not installed */ }
  }
  osToolCache = "none";
  return "none";
}

async function osLevelPaste(tool: Exclude<OsTool, "none">): Promise<void> {
  await sleep(30); // let focus settle
  try {
    if (tool === "xdotool") {
      spawn("xdotool", ["key", "--clearmodifiers", "ctrl+v"], { stdio: "ignore" });
    } else if (tool === "ydotool") {
      // 29 = L_CTRL, 47 = V — press then release
      spawn("ydotool", ["key", "29:1", "47:1", "47:0", "29:0"], { stdio: "ignore" });
    } else {
      spawn("wtype", ["-M", "ctrl", "v", "-m", "ctrl"], { stdio: "ignore" });
    }
  } catch (err) {
    console.error("[voice-coder] OS paste failed:", err);
  }
}

async function vscodePasteFallback(): Promise<void> {
  try {
    await vscode.commands.executeCommand("editor.action.clipboardPasteAction");
  } catch { /* widget didn't accept it */ }
  if (!warnedNoTool) {
    warnedNoTool = true;
    void vscode.window.showWarningMessage(
      "voice-coder: install xdotool (X11) or ydotool/wtype (Wayland) so pasting works in Copilot Chat, terminals, and other webviews — not just the editor.",
      "How to install",
    ).then((choice) => {
      if (choice === "How to install") {
        void vscode.env.openExternal(
          vscode.Uri.parse("https://github.com/jordansissel/xdotool#installing"),
        );
      }
    });
  }
}

async function safeReadClipboard(): Promise<string | null> {
  try {
    return await vscode.env.clipboard.readText();
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
