# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Engineering foundation: ESLint (type-aware) + Prettier, stricter `tsconfig`,
  `.editorconfig`, `.nvmrc`, GitHub Actions CI, and a Vitest test suite covering the
  pure logic (WAV silence detection, config/profile/history stores, key masking).
- `CONTRIBUTING.md` and this changelog.

### Changed

- Extracted pure WAV-level/silence detection into `src/cli/audio.ts` and API-key
  masking into `src/cli/secret.ts` for testability and reuse.

## [0.1.0] - 2026-05

Initial working version (CLI + VS Code extension).

### Added

- Voice dictation powered by Gemini, with Malayalam→English translation profiles.
- Standalone Linux CLI (`voice-coder`) bound to a global shortcut; records via
  arecord/sox/ffmpeg, pastes into any focused input via xclip + xdotool.
- Web dashboard for config, profiles, history, and logs.
- Panel tray status indicator (XApp/AppIndicator) replacing popup notifications.
- Multi-profile system with per-profile model and system instruction.
- Silence guard to avoid hallucinated transcripts on empty audio.
- Linways ExamController domain glossary profile.
