# Contributing to Voice Coder

Thanks for your interest! This guide covers the dev workflow.

## Prerequisites

- Node ≥ 20 (see `.nvmrc` — run `nvm use`)
- pnpm 10 (`corepack enable` or `npm i -g pnpm`)
- Linux system tools for runtime testing: `arecord` (alsa-utils), `xclip`, `xdotool`

## Setup

```bash
pnpm install
```

## Common commands

| Command                  | What it does                                              |
| ------------------------ | --------------------------------------------------------- |
| `pnpm run type-check`    | TypeScript type-check (no emit)                           |
| `pnpm run lint`          | ESLint (type-aware)                                       |
| `pnpm run lint:fix`      | Auto-fix lint issues                                      |
| `pnpm run format`        | Format with Prettier                                      |
| `pnpm run format:check`  | Verify formatting                                         |
| `pnpm run test`          | Run the Vitest suite                                      |
| `pnpm run test:watch`    | Tests in watch mode                                       |
| `pnpm run test:coverage` | Tests with coverage report                                |
| `pnpm run compile`       | Build both the CLI and the VS Code extension              |
| `pnpm run ci`            | Everything CI runs, in order                              |
| `pnpm run install:cli`   | Build + symlink the `voice-coder` CLI into `~/.local/bin` |

Run `pnpm run ci` before opening a PR — it mirrors the GitHub Actions pipeline.

## Project layout

```
src/
├── extension.ts        VS Code extension entry
├── recorder.ts         Shared: audio capture (arecord/sox/ffmpeg)
├── transcriber.ts      Shared: Gemini client
├── injector.ts         VS Code: clipboard + paste
├── config.ts/status.ts VS Code: settings + status bar
└── cli/                The standalone `voice-coder` CLI
    ├── main.ts         Command dispatch + process lifecycle
    ├── session.ts      record/stop/cancel state machine
    ├── audio.ts        Pure WAV level / silence detection (unit-tested)
    ├── config.ts       File-based config + API key
    ├── profiles.ts     Multi-profile store
    ├── store.ts        History + log files
    ├── inject.ts       Clipboard + OS-level paste
    ├── server.ts       Dashboard HTTP server
    ├── ui.ts           Dashboard single-page app (HTML/CSS/JS string)
    ├── uistate.ts      Shared state file for the tray
    └── secret.ts       API-key masking
scripts/
├── tray.py             Panel status indicator (XApp/AppIndicator)
└── install-*.sh        Install helpers
```

## Testing philosophy

Pure logic (audio analysis, config/profile/history CRUD, key masking) is unit-tested
with Vitest. Tests isolate filesystem state via a temp `XDG_CONFIG_HOME`. I/O-heavy
modules (spawning recorders, X11 paste) are intentionally thin wrappers and validated
manually — see the README's verification steps.

## Style

Formatting and lint are enforced (Prettier + ESLint). Match the surrounding code:
explain _why_ in comments, not _what_. Keep the CLI and extension sharing logic where
practical rather than duplicating it.
