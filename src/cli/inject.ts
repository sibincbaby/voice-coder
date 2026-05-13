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

  // Terminals use Ctrl+Shift+V, not Ctrl+V. Detect the active window class
  // and pick the right keystroke. We only escalate to ctrl+shift+v for
  // *known terminal emulator window classes* — sending it to a non-terminal
  // would either no-op or do something weird.
  const useTerminalPaste = isActiveWindowTerminal();

  try {
    if (tool === "xdotool") {
      const key = useTerminalPaste ? "ctrl+shift+v" : "ctrl+v";
      spawn("xdotool", ["key", "--clearmodifiers", key], { stdio: "ignore" });
    } else if (tool === "ydotool") {
      // 29 = L_CTRL, 42 = L_SHIFT, 47 = V
      const seq = useTerminalPaste
        ? ["29:1", "42:1", "47:1", "47:0", "42:0", "29:0"]
        : ["29:1", "47:1", "47:0", "29:0"];
      spawn("ydotool", ["key", ...seq], { stdio: "ignore" });
    } else {
      // wtype (Wayland)
      const args = useTerminalPaste
        ? ["-M", "ctrl", "-M", "shift", "v", "-m", "shift", "-m", "ctrl"]
        : ["-M", "ctrl", "v", "-m", "ctrl"];
      spawn("wtype", args, { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

// Known terminal-emulator window classes. Match case-insensitively against
// whatever `xdotool getactivewindow getwindowclassname` returns.
const TERMINAL_WINDOW_CLASSES = [
  "gnome-terminal", "konsole", "xterm", "alacritty", "kitty",
  "terminator", "tilix", "xfce4-terminal", "mate-terminal",
  "lxterminal", "lxterm", "urxvt", "rxvt", "termite", "wezterm",
  "foot", "hyper", "st-256color", "guake", "yakuake", "tabby",
  "warp", "cool-retro-term",
];

function isActiveWindowTerminal(): boolean {
  // Only works under X11. We read the active window's WM_CLASS via xprop
  // (xdotool doesn't expose window class directly). On Wayland this won't
  // work — caller falls back to plain ctrl+v.
  try {
    const wid = spawnSync("xdotool", ["getactivewindow"], { encoding: "utf8", timeout: 200 });
    if (wid.status !== 0) return false;
    const winId = (wid.stdout || "").trim();
    if (!winId) return false;

    const xp = spawnSync("xprop", ["-id", winId, "WM_CLASS"], { encoding: "utf8", timeout: 200 });
    if (xp.status !== 0) return false;
    // Output looks like:  WM_CLASS(STRING) = "gnome-terminal-server", "Gnome-terminal"
    const out = (xp.stdout || "").toLowerCase();
    return TERMINAL_WINDOW_CLASSES.some((t) => out.includes(t));
  } catch {
    return false;
  }
}

export function pasteToolName(): string {
  const t = detectPaste();
  return t === "none" ? "none" : t;
}
