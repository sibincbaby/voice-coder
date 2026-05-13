import { spawn, spawnSync, execSync } from "node:child_process";

type ClipboardTool = "xclip" | "xsel" | "wl-copy";
type PasteTool = "xdotool" | "ydotool" | "wtype";

function which(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch { return false; }
}

let clipboardCache: ClipboardTool | null = null;
function detectClipboard(): ClipboardTool {
  if (clipboardCache) return clipboardCache;
  for (const t of ["xclip", "xsel", "wl-copy"] as const) {
    if (which(t)) { clipboardCache = t; return t; }
  }
  throw new Error(
    "No clipboard tool found. Install one of: xclip (X11), xsel (X11), wl-copy (Wayland).\n" +
    "  sudo apt install xclip",
  );
}

let pasteCache: PasteTool | "none" | null = null;
function detectPaste(): PasteTool | "none" {
  if (pasteCache) return pasteCache;
  for (const t of ["xdotool", "ydotool", "wtype"] as const) {
    if (which(t)) { pasteCache = t; return t; }
  }
  pasteCache = "none";
  return "none";
}

export function writeClipboard(text: string): void {
  const tool = detectClipboard();
  const cmd =
    tool === "xclip" ? { bin: "xclip", args: ["-selection", "clipboard"] } :
    tool === "xsel"  ? { bin: "xsel",  args: ["--clipboard", "--input"] } :
                       { bin: "wl-copy", args: [] };
  const r = spawnSync(cmd.bin, cmd.args, { input: text, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`${cmd.bin} exited with status ${r.status}: ${r.stderr}`);
  }
}

export function readClipboard(): string {
  const tool = detectClipboard();
  const cmd =
    tool === "xclip" ? { bin: "xclip", args: ["-selection", "clipboard", "-o"] } :
    tool === "xsel"  ? { bin: "xsel",  args: ["--clipboard", "--output"] } :
                       { bin: "wl-paste", args: [] };
  const r = spawnSync(cmd.bin, cmd.args, { encoding: "utf8" });
  return r.stdout ?? "";
}

export function firePaste(): boolean {
  const tool = detectPaste();
  if (tool === "none") return false;
  try {
    if (tool === "xdotool") {
      spawn("xdotool", ["key", "--clearmodifiers", "ctrl+v"], { stdio: "ignore" });
    } else if (tool === "ydotool") {
      // 29 = L_CTRL, 47 = V
      spawn("ydotool", ["key", "29:1", "47:1", "47:0", "29:0"], { stdio: "ignore" });
    } else {
      spawn("wtype", ["-M", "ctrl", "v", "-m", "ctrl"], { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

export function pasteToolName(): string {
  const t = detectPaste();
  return t === "none" ? "none" : t;
}
