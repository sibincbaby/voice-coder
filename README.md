# Voice Coder

**Type by speaking.** Records your voice, sends it to Google's Gemini for transcription, and pastes the result into whatever input has focus. Comes in two flavors that share the same engine:

- **VS Code extension** — focused on Copilot Chat, the Claude Code terminal, the editor, anywhere inside VS Code.
- **`voice-coder` CLI** — a standalone Linux command-line tool you bind to a global keyboard shortcut. Works in **any application**: Chrome, Slack, the GNOME Terminal, your file manager's rename box, anywhere your cursor is.

Built for people who would rather talk than type, and especially useful for:

- Hands-rest / RSI recovery
- Coders who think out loud
- Anyone who speaks a non-English language (Malayalam, Hindi, Tamil, Spanish, …) and wants the LLM to translate to English on the fly
- Mixed-language dictation: speak Malayalam, sprinkle in `useState` and `package.json`, get clean English code-aware text

The trick is that **Gemini is an LLM, not a plain speech-to-text engine**. You can tell it via a system instruction to translate languages, expand dictated punctuation into symbols (`"arrow function"` → `() =>`), drop filler words, and so on — and it does. The default instruction is editable in settings.

---

## Quick start — VS Code extension

### 1. Prerequisites

Before installing the extension, make sure you have these on your system:

| Tool | Purpose | Install on Ubuntu/Debian |
|---|---|---|
| `arecord` | Records your microphone | `sudo apt install alsa-utils` (usually pre-installed) |
| `xdotool` | Pastes transcripts into Copilot Chat, terminals, **anywhere** | `sudo apt install xdotool` |
| A Gemini API key | The transcription brain | Free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

On **Wayland** instead of X11, install `ydotool` or `wtype` in place of `xdotool`. On **macOS** and **Windows**, you'll need an equivalent paste-keystroke utility — see [platform notes](#platform-notes) below.

Without an OS-level paste tool, transcripts will only land in the **editor** — they will not paste into Copilot Chat, terminals, or other webviews. The extension will warn you once and link to install instructions.

### 2. Install the extension

**From the VS Code Marketplace** (once published):

```bash
code --install-extension sibin.voice-coder
```

Or search "Voice Coder" in the VS Code Extensions sidebar (`Ctrl+Shift+X`).

**From a `.vsix` file** (if you got it directly or built it from source):

```bash
code --install-extension voice-coder-0.1.0.vsix
```

### 3. Set your Gemini API key

`Ctrl+Shift+P` → **Voice Coder: Set Gemini API Key** → paste your key.

The key is stored in VS Code's encrypted SecretStorage, never in any settings file.

### 4. Use it

1. Focus any input field (editor, Copilot Chat, terminal, search box).
2. Press **`Ctrl+Alt+V`** (macOS: `Cmd+Alt+V`). The status bar turns red and shows "Recording…".
3. Speak.
4. Press **`Ctrl+Alt+V`** again to stop. The transcript appears at your cursor a moment later.

| Key | What it does |
|---|---|
| `Ctrl+Alt+V` | Toggle recording: press once to start, press again to stop and transcribe |
| `Ctrl+Alt+X` | Cancel — discard audio (during recording) or abort the API call (during transcription) |
| `Esc` | Same as `Ctrl+Alt+X` but only while recording is active |

You can also click the microphone icon in the status bar to toggle recording.

---

## Quick start — Linux CLI (system-wide)

The CLI is the same engine without VS Code wrapped around it. You bind a global keyboard shortcut once; after that **any focused input on your machine** — Chrome address bar, Slack message box, terminal, a Java app, anything — becomes voice-typeable.

### 1. Prerequisites

Same as the VS Code flavor, plus a clipboard writer:

| Tool | Purpose | Install on Ubuntu/Debian |
|---|---|---|
| `arecord` | Audio capture | `sudo apt install alsa-utils` |
| `xclip` | Writes the transcript to the clipboard | `sudo apt install xclip` |
| `xdotool` | Fires Ctrl+V so the transcript auto-pastes | `sudo apt install xdotool` |
| `notify-send` | Desktop notifications | `sudo apt install libnotify-bin` |
| `node` (≥ 20) | Runs the CLI bundle | already installed if you have pnpm |

For Wayland sessions, install `wl-clipboard` and either `ydotool` or `wtype` instead of `xclip`/`xdotool`.

### 2. Install

From this repo:

```bash
cd voice-coder
pnpm install
pnpm run install:cli
```

That builds `out/cli.js` and symlinks it into `~/.local/bin/voice-coder`. If `~/.local/bin` isn't on your PATH, the install script tells you what to add to `~/.bashrc`.

To uninstall: `rm ~/.local/bin/voice-coder`.

### 3. Set your Gemini API key

```bash
voice-coder set-key
# (paste your key; it's not echoed)
```

The key is saved to `~/.config/voice-coder/api-key` with mode `0600`. You can also point at it via env var: `export GEMINI_API_KEY=...`.

### 4. Bind a global keyboard shortcut

The CLI is **stateful by design**: the same command both starts and stops recording. So you only need to bind one key to one command.

**GNOME** (Settings → Keyboard → View and Customize Shortcuts → Custom Shortcuts → `+`):

| Field | Value |
|---|---|
| Name | `Voice Coder Toggle` |
| Command | `voice-coder toggle` (or absolute path: `/home/<you>/.local/bin/voice-coder toggle`) |
| Shortcut | Whatever you like — `Ctrl+Alt+V`, `Super+V`, `F12`, etc. |

Bind a second shortcut to `voice-coder cancel` for discarding a recording, or `voice-coder stop --copy-only` if you want clipboard-only mode (no auto-paste).

**KDE Plasma**: System Settings → Shortcuts → Custom Shortcuts → Edit → New → Global Shortcut → Command/URL.

**Hyprland / Sway / i3**: bind in your config:
```
bind = SUPER, V, exec, voice-coder toggle
```

**As a fallback**, you can always run `voice-coder toggle` from a terminal.

### 5. Use it

1. Focus any input field anywhere on your machine.
2. Press your shortcut. A "Recording…" notification appears.
3. Speak.
4. Press the shortcut again. A "Transcribing…" notification appears, then your transcript:
   - is **copied to the clipboard** (always), and
   - is **auto-pasted** at your cursor (if `autoPaste` is enabled — default).

If auto-paste lands in the wrong place or VS Code stole focus, just `Ctrl+V` to paste from the clipboard.

### CLI commands

```bash
voice-coder toggle              # start, or stop and transcribe (the one to bind)
voice-coder stop                # explicit stop
voice-coder stop --copy-only    # stop, copy to clipboard, but don't auto-paste
voice-coder cancel              # discard active recording without transcribing
voice-coder status              # idle / recording with elapsed time
voice-coder set-key             # save Gemini API key (stdin, chmod 600)
voice-coder clear-key
voice-coder config              # print effective config + paths
```

### CLI configuration

Edit `~/.config/voice-coder/config.json`. All keys are optional; missing keys fall back to the defaults.

```json
{
  "model": "gemini-3.1-flash-lite",
  "systemInstruction": "…your custom prompt…",
  "audioTool": "auto",
  "sampleRate": 16000,
  "maxRecordingSeconds": 120,
  "autoPaste": true,
  "notify": true
}
```

| Setting | Default | Purpose |
|---|---|---|
| `model` | `gemini-3.1-flash-lite` | Any Gemini model that accepts audio |
| `systemInstruction` | translation prompt | Edit freely — see the [VS Code section](#customizing-the-system-instruction) for examples |
| `audioTool` | `auto` | `auto` / `arecord` / `sox` / `ffmpeg` |
| `sampleRate` | `16000` | Hz |
| `maxRecordingSeconds` | `120` | Hard auto-stop |
| `autoPaste` | `true` | If false, transcript only goes to the clipboard |
| `notify` | `true` | Send desktop notifications via `notify-send` |

Changes take effect on the next `voice-coder` invocation — no service to restart.

---

## VS Code configuration

All extension settings live under `voiceCoder.*` in your VS Code `settings.json`. Change them with `Ctrl+,` (search `voiceCoder`) or by editing `settings.json` directly. **Changes take effect immediately — no reload needed.**

| Setting | Default | Purpose |
|---|---|---|
| `voiceCoder.model` | `gemini-3.1-flash-lite` | Any Gemini model that supports audio input |
| `voiceCoder.systemInstruction` | (translation-focused, see below) | The prompt that shapes the output — edit freely |
| `voiceCoder.audioTool` | `auto` | `auto` \| `arecord` \| `sox` \| `ffmpeg` |
| `voiceCoder.sampleRate` | `16000` | Hz |
| `voiceCoder.injectionMethod` | `clipboard-paste` | `clipboard-paste` (universal) \| `type-command` (editor only) |
| `voiceCoder.maxRecordingSeconds` | `120` | Hard auto-stop after this many seconds |
| `voiceCoder.restoreClipboard` | `false` | If true, restore your previous clipboard after pasting. Default false keeps the transcript in your clipboard so you can paste it again manually. |

### Customizing the system instruction

The system instruction is the most powerful knob. The default tells Gemini:

> You are a speech-to-English translator for a developer. The user speaks Malayalam, often mixed with English technical/code terms. ALWAYS output English. NEVER output Malayalam script. Preserve identifiers, file paths, and code terms verbatim. Render dictated punctuation as actual symbols (`"open paren"` → `(`, `"arrow function"` → `() =>`, `"new line"` → real newline). Output only the final text, no preamble.

Edit `voiceCoder.systemInstruction` in settings to change behavior:

- **Want raw transcription in your native language?** Replace the rules with: *"Transcribe the audio verbatim in the spoken language. Output only the transcript."*
- **Want a different target language?** Change "English" to "French" / "Hindi" / etc.
- **Want a glossary of your own dictated shortcuts?** Add: *"When the user says 'log it', output `console.log()`. When they say 'tryblock', output `try { } catch (err) { }`."*
- **Want it to fix grammar?** Add: *"Lightly fix grammar and clarity without changing meaning."*

Gemini follows the instruction strictly — experiment.

### Choosing a model

- **`gemini-3.1-flash-lite`** (default) — fastest and cheapest, ~$0.25 per million input tokens. Good for short dictation.
- **`gemini-3-flash`** — more accurate, follows complex system instructions more reliably. Use if Lite is missing detail or ignoring directives.
- **`gemini-2.5-flash`** — older but still solid.

Any model that accepts audio input should work. You can swap models any time without reinstalling.

---

## Platform notes

### Linux (X11)
Use `xdotool`. Tested on Ubuntu 22.04 / 24.04.

### Linux (Wayland)
Use `ydotool` (requires running a daemon — see [ydotool docs](https://github.com/ReimuNotMoe/ydotool)) or `wtype` (no daemon needed; KDE/Sway/Hyprland). The extension auto-detects.

### macOS
**Not fully tested.** The recorder code expects `sox` or `ffmpeg` (Homebrew: `brew install sox ffmpeg`). The OS-level paste needs an AppleScript equivalent — not yet implemented. Contributions welcome.

### Windows
**Not yet supported.** Would need PowerShell-based audio capture and `SendKeys`-based paste. Contributions welcome.

---

## How it works

```
Ctrl+Alt+V  ──▶  arecord (native CLI)  ──WAV──▶  Gemini API (inline base64)
                                                       │
                                                       ▼ transcribed text
                              ┌──── Clipboard ◀────────┘
                              ▼
                       xdotool Ctrl+V ──▶ Focused input field
                                          (editor / Copilot Chat / terminal)
                              │
                              └── Previous clipboard restored 400ms later
```

**Why a native CLI recorder?** VS Code webviews block `getUserMedia` and there's no extension API to enable microphone permissions. Every voice extension that touches a microphone (VoxPilot, vscode-speech-to-text, …) shells out to a native recorder.

**Why an OS-level Ctrl+V instead of VS Code's paste command?** The `editor.action.clipboardPasteAction` command silently no-ops in webviews (Copilot Chat) and the integrated terminal. A real OS-level keystroke works wherever your keyboard focus is.

---

## Troubleshooting

**"No audio recorder found"**
Install `alsa-utils`: `sudo apt install alsa-utils`.

**Transcript appears in editor but not in Copilot Chat / terminal**
Install `xdotool` (X11) or `ydotool`/`wtype` (Wayland). The extension warns about this on first use.

**"Recording produced no audio"**
Your default ALSA input device is misconfigured. Run `arecord -L` to list devices; set the default in `~/.asoundrc`, or switch `voiceCoder.audioTool` to `ffmpeg` and pass an explicit device.

**Output is in the wrong language (e.g., Malayalam instead of English)**
Edit `voiceCoder.systemInstruction` and make the language directive more explicit. Try a stronger model: set `voiceCoder.model` to `gemini-3-flash`.

**Empty transcript**
Speak louder/longer. Make sure your microphone isn't muted (`pavucontrol` on Linux). Check the Output panel → "Voice Coder" channel for errors.

**API key prompts every time**
Run **Voice Coder: Clear Gemini API Key**, then set it again. The key is stored under VS Code's SecretStorage namespace `voiceCoder.apiKey`.

**Pasting twice / extra characters**
This can happen if both `xdotool` and `editor.action.clipboardPasteAction` fire. The extension uses the OS-level paste whenever an OS tool is available; if you see duplicates, file an issue with your platform details.

---

## Build from source

For contributors or anyone who wants to modify the extension or CLI:

```bash
git clone https://github.com/sibincbaby/voice-coder.git
cd voice-coder
pnpm install

pnpm run compile               # builds BOTH out/extension.js and out/cli.js
pnpm run compile:extension     # only the VS Code bundle
pnpm run compile:cli           # only the CLI bundle

pnpm run package               # produces voice-coder-X.Y.Z.vsix
pnpm run install:cli           # builds CLI and symlinks to ~/.local/bin/voice-coder
```

To iterate on the VS Code extension without re-packaging on every change:

```bash
pnpm run watch &                                # rebuilds the extension on save
code --extensionDevelopmentPath=$(pwd)          # launches a dev host
```

In the dev host, edit a source file → save → reload window (`Ctrl+R`).

To iterate on the CLI, just re-run `pnpm run compile:cli` — the symlink in `~/.local/bin` points at the same `out/cli.js` so the next invocation picks up your changes.

### Source layout

```
src/
├── extension.ts     VS Code: activation, commands, state machine
├── recorder.ts      Shared: detect + spawn arecord / sox / ffmpeg
├── transcriber.ts   Shared: @google/genai client with inline audio + sys instruction
├── injector.ts      VS Code: clipboard + OS-level Ctrl+V
├── config.ts        VS Code: settings reader + SecretStorage for API key
├── status.ts        VS Code: status bar item
└── cli/
    ├── main.ts      CLI entry: argument parsing, state machine, notifications
    ├── inject.ts    CLI: xclip/xsel/wl-copy + xdotool/ydotool/wtype
    └── config.ts    CLI: ~/.config/voice-coder/{config.json,api-key}

scripts/
└── install-cli.sh   Symlinks out/cli.js to ~/.local/bin/voice-coder
```

---

## Roadmap

- [ ] macOS support (recorder + paste backend)
- [ ] Windows support
- [ ] Streaming transcription via Gemini Live API (lower latency)
- [ ] Voice activity detection (auto-stop on silence)
- [ ] Multiple system-instruction profiles with a quick-pick switcher
- [ ] Transcript history panel with re-paste

---

## Contributing

PRs welcome. Please:

1. Run `pnpm run type-check` before submitting.
2. Test on your platform end-to-end (record → transcribe → paste into Copilot Chat).
3. Don't add dependencies casually — the extension is intentionally tiny.

---

## Privacy

- Audio is sent to Google's Gemini API. Read [Google's terms](https://ai.google.dev/gemini-api/terms) for what they do with it.
- Audio is written briefly to your OS temp directory during the request, then deleted.
- Your Gemini API key is stored in VS Code's SecretStorage, never in any settings file or log.
- No telemetry, no analytics, no network calls except the one to Gemini.

---

## License

MIT — see [LICENSE](./LICENSE).
