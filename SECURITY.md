# Security Policy

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue.
Use GitHub's [private vulnerability reporting](https://github.com/sibincbaby/voice-coder/security/advisories/new)
for this repository, or email the maintainer.

You can expect an initial response within a few days. Please include:

- A description of the issue and its impact
- Steps to reproduce
- Affected version / commit

## Scope and design notes

Voice Coder runs locally and talks to two trust boundaries:

- **The Gemini API** — your audio is sent to Google for transcription. Your API
  key is stored in `~/.config/voice-coder/api-key` with `0600` permissions (or
  read from the `GEMINI_API_KEY` environment variable). It is never written to
  `config.json` or logs.
- **The local dashboard server** (`voice-coder ui`) — binds to `127.0.0.1` only
  and protects all `/api` routes with a per-session CSRF token plus a localhost
  `Host` allowlist, so other local apps and websites you visit cannot drive it.

If you find a way for a remote page or another local process to read the API key,
trigger recordings, or change configuration without the session token, that's a
vulnerability we want to hear about.
