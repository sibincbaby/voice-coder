# Voice Coder

[![CI](https://github.com/sibincbaby/voice-coder/actions/workflows/ci.yml/badge.svg)](https://github.com/sibincbaby/voice-coder/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

> System-wide voice typing for Linux, powered by Gemini.

**Type by speaking.** `voice-coder` records your voice, sends it to Google's Gemini for transcription, and pastes the result into whatever input has focus. Bind it to a global keyboard shortcut once, and **any focused input on your machine** — Chrome's address bar, Slack's message box, a terminal, your file manager's rename box, anywhere your cursor is — becomes voice-typeable.

Built for people who would rather talk than type, and especially useful for:

- Hands-rest / RSI recovery
- Coders who think out loud
- Anyone who speaks a non-English language (Malayalam, Hindi, Tamil, Spanish, …) and wants the LLM to translate to English on the fly
- Mixed-language dictation: speak Malayalam, sprinkle in `useState` and `package.json`, get clean English code-aware text

The trick is that **Gemini is an LLM, not a plain speech-to-text engine**. You can tell it via a system instruction to translate languages, expand dictated punctuation into symbols (`"arrow function"` → `() =>`), drop filler words, and so on — and it does. The default instruction is a translation example you can fully rewrite for your own dictation style.

---

## Install

### npm (recommended)

```bash
npm install -g voice-coder
```

This puts a `voice-coder` command on your PATH.

### From source

```bash
git clone https://github.com/sibincbaby/voice-coder.git
cd voice-coder
pnpm install
pnpm run install:cli
```

That builds `out/cli.js` and symlinks it into `~/.local/bin/voice-coder`. If `~/.local/bin` isn't on your PATH, the install script tells you what to add to `~/.bashrc`.

To uninstall the source install: `rm ~/.local/bin/voice-coder`.

### From GitHub releases

Grab the latest bundle from the [Releases](https://github.com/sibincbaby/voice-coder/releases) page and run it with `node out/cli.js`, or symlink it onto your PATH.

### Prerequisites

You need **Node ≥ 20** plus a handful of Linux command-line tools:

| Tool          | Purpose                                    | Install on Ubuntu/Debian         |
| ------------- | ------------------------------------------ | -------------------------------- |
| `arecord`     | Records your microphone                    | `sudo apt install alsa-utils`    |
| `xclip`       | Writes the transcript to the clipboard     | `sudo apt install xclip`         |
| `xdotool`     | Fires Ctrl+V so the transcript auto-pastes | `sudo apt install xdotool`       |
| `notify-send` | Desktop notifications                      | `sudo apt install libnotify-bin` |

For **Wayland** sessions, install `wl-clipboard` and either `ydotool` or `wtype` in place of `xclip`/`xdotool`. The CLI auto-detects what's available. See [platform notes](#platform-notes) for details.

You'll also need a Gemini API key — free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

---

## Set your Gemini API key

```bash
voice-coder set-key
# (paste your key; it's not echoed)
```

The key is saved to `~/.config/voice-coder/api-key` with mode `0600`. You can also point at it via env var: `export GEMINI_API_KEY=...`.

---

## Bind a global keyboard shortcut

The CLI is **stateful by design**: the same command both starts and stops recording. So you only need to bind one key to one command.

**GNOME** (Settings → Keyboard → View and Customize Shortcuts → Custom Shortcuts → `+`):

| Field    | Value                                                                                |
| -------- | ------------------------------------------------------------------------------------ |
| Name     | `Voice Coder Toggle`                                                                 |
| Command  | `voice-coder toggle` (or absolute path: `/home/<you>/.local/bin/voice-coder toggle`) |
| Shortcut | Whatever you like — `Ctrl+Alt+V`, `Super+V`, `F12`, etc.                             |

Bind a second shortcut to `voice-coder cancel` for discarding a recording, or `voice-coder stop --copy-only` if you want clipboard-only mode (no auto-paste).

**KDE Plasma**: System Settings → Shortcuts → Custom Shortcuts → Edit → New → Global Shortcut → Command/URL.

**Hyprland / Sway / i3**: bind in your config:

```
bind = SUPER, V, exec, voice-coder toggle
```

**As a fallback**, you can always run `voice-coder toggle` from a terminal.

---

## Use it

1. Focus any input field anywhere on your machine.
2. Press your shortcut. A "Recording…" notification appears.
3. Speak.
4. Press the shortcut again. A "Transcribing…" notification appears, then your transcript:
   - is **copied to the clipboard** (always), and
   - is **auto-pasted** at your cursor (if `autoPaste` is enabled — default).

If auto-paste lands in the wrong place or another window stole focus, just `Ctrl+V` to paste from the clipboard.

---

## CLI commands

```bash
voice-coder toggle                    # start, or stop and transcribe (the one to bind)
voice-coder stop                      # explicit stop
voice-coder stop --copy-only          # stop, copy to clipboard, but don't auto-paste
voice-coder cancel                    # discard active recording without transcribing
voice-coder status                    # idle / recording with elapsed time
voice-coder analyze <file>            # transcribe a local audio file → JSON output
voice-coder analyze <file> --profile  # use a specific profile by id or name
voice-coder set-key                   # save Gemini API key (stdin, chmod 600)
voice-coder clear-key
voice-coder config                    # print effective config + paths
voice-coder ui [--port 7777]          # open the web dashboard (config, history, logs)
voice-coder --version                 # print version
```

---

## Web dashboard

Run `voice-coder ui` to open a local web UI at `http://localhost:7777` for editing settings without touching JSON, managing your API key, browsing past transcriptions, and tailing the log file. The server binds to **loopback only** — no remote access — is CSRF-protected, and shuts down on Ctrl+C.

| Tab         | What it does                                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Config**  | Model picker, system instruction (the prompt that shapes Gemini's output), sample rate, max recording length, auto-paste toggle, notification toggle. Saved on click; the next `voice-coder toggle` picks them up. |
| **API Key** | Masked display of the stored key. Set a new one, clear it, or "Test connection" — sends a tiny prompt to Gemini and reports latency / error.                                                                       |
| **History** | All past transcriptions (up to 500 most recent) with timestamp, model, audio size, API latency, and a one-click copy button.                                                                                       |
| **Logs**    | Tail of `~/.config/voice-coder/voice-coder.log`. Auto-refreshes every 2s. Rotates at 1MB.                                                                                                                          |

---

## CLI configuration

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

| Setting               | Default                 | Purpose                                                                                     |
| --------------------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| `model`               | `gemini-3.1-flash-lite` | Any Gemini model that accepts audio                                                         |
| `systemInstruction`   | translation prompt      | Edit freely — see [Customizing the system instruction](#customizing-the-system-instruction) |
| `audioTool`           | `auto`                  | `auto` / `arecord` / `sox` / `ffmpeg`                                                       |
| `sampleRate`          | `16000`                 | Hz                                                                                          |
| `maxRecordingSeconds` | `120`                   | Hard auto-stop                                                                              |
| `autoPaste`           | `true`                  | If false, transcript only goes to the clipboard                                             |
| `notify`              | `true`                  | Send desktop notifications via `notify-send`                                                |

Changes take effect on the next `voice-coder` invocation — no service to restart. Multiple system-instruction **profiles** are also supported; manage them from the dashboard or your config.

---

## Customizing the system instruction

The system instruction is the most powerful knob — it's the prompt that shapes everything Gemini outputs. Voice Coder is a **general-purpose dictation tool**; the shipped default is just one useful example (speech → English translation for a developer). Rewrite it for whatever workflow you have.

The default instruction tells Gemini:

> You are a speech-to-English translator for a developer. The user speaks Malayalam, often mixed with English technical/code terms. ALWAYS output English. NEVER output Malayalam script. Preserve identifiers, file paths, and code terms verbatim. Render dictated punctuation as actual symbols (`"open paren"` → `(`, `"arrow function"` → `() =>`, `"new line"` → real newline). Output only the final text, no preamble.

Edit `systemInstruction` in your config (or in the dashboard's Config tab) to change behavior:

- **Want raw transcription in your native language?** Replace the rules with: _"Transcribe the audio verbatim in the spoken language. Output only the transcript."_
- **Want a different target language?** Change "English" to "French" / "Hindi" / etc.
- **Want a glossary of your own dictated shortcuts?** Add: _"When the user says 'log it', output `console.log()`. When they say 'tryblock', output `try { } catch (err) { }`."_
- **Want it to fix grammar?** Add: _"Lightly fix grammar and clarity without changing meaning."_

Gemini follows the instruction strictly — experiment. Keep distinct instructions as separate **profiles** and switch between them.

---

## Choosing a model

- **`gemini-3.1-flash-lite`** (default) — fastest and cheapest, ~$0.25 per million input tokens. Good for short dictation.
- **`gemini-3-flash`** — more accurate, follows complex system instructions more reliably. Use if Lite is missing detail or ignoring directives.
- **`gemini-2.5-flash`** — older but still solid.

Any model that accepts audio input should work. You can swap models any time without reinstalling.

---

## Platform notes

### Linux (X11)

Use `xclip` + `xdotool`. Tested on Ubuntu 22.04 / 24.04.

### Linux (Wayland)

Use `wl-clipboard` for the clipboard, plus `ydotool` (requires running a daemon — see [ydotool docs](https://github.com/ReimuNotMoe/ydotool)) or `wtype` (no daemon needed; KDE/Sway/Hyprland) for the paste keystroke. The CLI auto-detects which tools are present.

### macOS

**Not yet supported.** The recorder code expects `sox` or `ffmpeg` (Homebrew: `brew install sox ffmpeg`), and the OS-level paste needs an AppleScript equivalent that isn't implemented yet. Contributions welcome.

### Windows

**Not yet supported.** Would need PowerShell-based audio capture and `SendKeys`-based paste. Contributions welcome.

---

## How it works

```
your shortcut  ──▶  arecord (native CLI)  ──WAV──▶  Gemini API (inline base64)
                                                        │
                                                        ▼ transcribed text
                               ┌──── Clipboard ◀────────┘
                               ▼
                   xdotool Ctrl+V ──▶ Focused input field
                                      (any app: Chrome, Slack, terminal, …)
```

**Why a native CLI recorder?** Shelling out to `arecord` (or `sox` / `ffmpeg`) is the most portable way to capture the microphone on Linux without pulling in a browser runtime or audio library.

**Why an OS-level Ctrl+V instead of typing the characters?** A real OS-level paste keystroke lands the transcript wherever your keyboard focus is — including terminals, webviews, and apps that ignore synthetic per-character typing — and it's instant regardless of transcript length.

---

## Troubleshooting

**"No audio recorder found"**
Install `alsa-utils`: `sudo apt install alsa-utils`.

**Transcript copied to clipboard but not auto-pasted**
Install `xdotool` (X11) or `ydotool`/`wtype` (Wayland). The transcript is always on your clipboard, so you can `Ctrl+V` manually in the meantime.

**"Recording produced no audio"**
Your default ALSA input device is misconfigured. Run `arecord -L` to list devices; set the default in `~/.asoundrc`, or switch `audioTool` to `ffmpeg` and pass an explicit device.

**Output is in the wrong language (e.g., Malayalam instead of English)**
Edit `systemInstruction` and make the language directive more explicit. Try a stronger model: set `model` to `gemini-3-flash`.

**Empty transcript**
Speak louder/longer. Make sure your microphone isn't muted (`pavucontrol` on Linux). Check `~/.config/voice-coder/voice-coder.log` (or the dashboard's Logs tab) for errors.

**API key prompts every time**
Run `voice-coder clear-key`, then `voice-coder set-key` again. The key lives at `~/.config/voice-coder/api-key` with mode `0600`.

**Pasting twice / extra characters**
File an issue with your platform details (X11 vs Wayland, which paste tool) so it can be reproduced.

---

## Build from source

For contributors or anyone who wants to modify the CLI:

```bash
git clone https://github.com/sibincbaby/voice-coder.git
cd voice-coder
pnpm install

pnpm run compile          # builds out/cli.js + out/dashboard.js
pnpm run compile:cli      # only the CLI bundle
pnpm run install:cli      # builds the CLI and symlinks it to ~/.local/bin/voice-coder
```

To iterate, just re-run `pnpm run compile:cli` — the symlink in `~/.local/bin` points at the same `out/cli.js`, so the next invocation picks up your changes.

### Source layout

```
src/
├── main.ts          CLI entry: arg parsing, state machine, notifications
├── session.ts       record/stop/cancel state machine
├── recorder.ts      detect + spawn arecord / sox / ffmpeg
├── transcriber.ts   @google/genai client (inline audio + system instruction)
├── inject.ts        clipboard (xclip/wl-copy) + OS-level paste (xdotool/ydotool/wtype)
├── audio.ts         WAV level / silence detection (unit-tested)
├── config.ts        ~/.config/voice-coder/{config.json,api-key}
├── profiles.ts      multi-profile store
├── store.ts         history + log files
├── server.ts        dashboard HTTP server (CSRF-protected, loopback only)
├── which.ts         shell-free PATH lookup
├── uistate.ts       shared state file for the tray
├── secret.ts        API-key masking
└── ui/              dashboard SPA (index.html, style.css, app.ts)
scripts/
├── tray.py          panel status indicator (XApp/AppIndicator)
└── install-*.sh     install helpers
```

---

## Roadmap

- [ ] macOS support (recorder + paste backend)
- [ ] Windows support
- [ ] Streaming transcription via Gemini Live API (lower latency)
- [ ] Voice activity detection (auto-stop on silence)
- [ ] npm-published prebuilt binaries

---

## Contributing

PRs welcome. Please:

1. Run `pnpm run type-check` and `pnpm test` before submitting.
2. Test on your platform end-to-end (record → transcribe → paste into a real app).
3. Don't add dependencies casually — the tool is intentionally tiny.

---

## Privacy

- Audio is sent to Google's Gemini API. Read [Google's terms](https://ai.google.dev/gemini-api/terms) for what they do with it.
- Audio is written briefly to your OS temp directory during the request, then deleted.
- Your Gemini API key is stored at `~/.config/voice-coder/api-key` with mode `0600`, never in a log.
- The dashboard server binds to loopback only and is CSRF-protected.
- No telemetry, no analytics, no network calls except the one to Gemini.

---

## License

MIT — see [LICENSE](./LICENSE).
