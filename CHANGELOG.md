# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Engineering foundation: ESLint (type-aware) + Prettier, stricter `tsconfig`,
  `.editorconfig`, `.nvmrc`, GitHub Actions CI, and a Vitest test suite covering the
  pure logic (WAV silence detection, config/profile/history stores, key masking,
  PATH lookup, recorder command builder, server auth).
- `CONTRIBUTING.md` and this changelog.
- Repo hygiene: `SECURITY.md`, issue/PR templates, Dependabot, `.gitattributes`,
  a tagged-release workflow that publishes the `.vsix` + CLI tarball, a CI badge,
  and `engines.node` / `files` / `os` fields in `package.json`.

### Security

- The dashboard HTTP server now requires a per-session CSRF token (embedded in the
  served HTML, sent as `X-VC-Token`) on all `/api` routes, plus a localhost `Host`
  allowlist to block DNS-rebinding. Previously any website the user visited could
  drive the local API (start recordings, rewrite the system instruction). A tokenless
  `/api/health` probe remains for server discovery.

### Changed

- Extracted pure logic into testable modules: WAV-level/silence (`audio.ts`), API-key
  masking (`secret.ts`), PATH lookup (`which.ts`), and server auth (`auth.ts`).
- De-duplicated the recorder command builder (was copied in `recorder.ts` and
  `session.ts`) into a single `buildRecorderCommand`.
- Replaced `execSync(\`command -v …\`)` tool detection with a shell-free PATH lookup.

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
