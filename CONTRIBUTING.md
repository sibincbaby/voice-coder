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
| `pnpm run compile`       | Build the CLI bundle + the dashboard bundle               |
| `pnpm run ci`            | Everything CI runs, in order                              |
| `pnpm run install:cli`   | Build + symlink the `voice-coder` CLI into `~/.local/bin` |

Run `pnpm run ci` before opening a PR — it mirrors the GitHub Actions pipeline.

## Project layout

```
src/
├── main.ts         Command dispatch + process lifecycle
├── session.ts      record/stop/cancel state machine
├── recorder.ts     Audio capture (arecord/sox/ffmpeg)
├── transcriber.ts  Gemini client
├── inject.ts       Clipboard + OS-level paste
├── audio.ts        Pure WAV level / silence detection (unit-tested)
├── config.ts       File-based config + API key
├── profiles.ts     Multi-profile store
├── store.ts        History + log files
├── server.ts       Dashboard HTTP server
├── which.ts        Shell-free PATH lookup
├── uistate.ts      Shared state file for the tray
├── secret.ts       API-key masking
└── ui/             Dashboard SPA: index.html, style.css, app.ts (typed, bundled separately)
scripts/
├── tray.py         Panel status indicator (XApp/AppIndicator)
└── install-*.sh    Install helpers
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
