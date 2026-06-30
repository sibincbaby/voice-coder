# voice-coder analyze — Skill

Transcribe a local audio file using Gemini and receive structured JSON output.

## Command

```bash
voice-coder analyze <path-to-audio-file> [--profile <id|name>]
```

## When to use

Use this skill whenever you have a local audio file and need its spoken content as text — bug reports recorded by a user, meeting snippets, voice notes, or any attachment that is an audio file.

## Supported formats

`wav`, `mp3`, `ogg`, `flac`, `m4a`, `aac`, `webm`

## Output (stdout, always JSON)

```json
{
  "file": "/absolute/path/to/audio.m4a",
  "profile": "Default",
  "text": "Transcribed text here."
}
```

- `file` — resolved absolute path of the input
- `profile` — name of the profile used for transcription
- `text` — clean transcribed (and translated to English) text

Parse with `JSON.parse()` or pipe through `jq`.

## Options

| Flag | Description |
|------|-------------|
| `--profile <id\|name>` | Use a specific profile instead of the active one. Accepts profile ID or display name (case-insensitive). |

## Profiles

Profiles control the Gemini model, system instruction (language/format rules), and other settings. The **Default** profile translates Malayalam-mixed speech to clean English. List available profiles:

```bash
voice-coder config
```

## Prerequisites

- `voice-coder` CLI installed and on PATH
- Gemini API key set: `voice-coder set-key`

## Example usage

```bash
# Basic transcription
voice-coder analyze /tmp/recording.m4a

# With a specific profile
voice-coder analyze /tmp/recording.wav --profile "Code Dictation"

# Capture just the text
voice-coder analyze /tmp/note.mp3 | jq -r '.text'
```

## Error cases

| Exit code | Reason |
|-----------|--------|
| `1` | File not found |
| `1` | No API key configured |
| `1` | Unknown profile name/id |
| `1` | Gemini returned empty transcript (silent/too short audio) |

On error, a human-readable message is printed to stderr and exit code is `1`. stdout is empty on error.
