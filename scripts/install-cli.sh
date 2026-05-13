#!/usr/bin/env bash
# Symlinks out/cli.js into ~/.local/bin/voice-coder so you can run
# `voice-coder` from anywhere. Idempotent.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/out/cli.js"
BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"
LINK="$BIN_DIR/voice-coder"

if [[ ! -f "$TARGET" ]]; then
  echo "✗ $TARGET not found. Run 'pnpm run compile:cli' first." >&2
  exit 1
fi

mkdir -p "$BIN_DIR"

if [[ -L "$LINK" || -e "$LINK" ]]; then
  rm -f "$LINK"
fi

ln -s "$TARGET" "$LINK"
chmod +x "$TARGET"

echo "✓ Installed: $LINK -> $TARGET"

# Path sanity check
if ! echo ":$PATH:" | grep -q ":$BIN_DIR:"; then
  echo
  echo "⚠  $BIN_DIR is not in your PATH."
  echo "   Add this to ~/.bashrc or ~/.zshrc:"
  echo "     export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo "   Then start a new shell or run: source ~/.bashrc"
else
  echo
  echo "Try it:"
  echo "  voice-coder help"
  echo "  voice-coder set-key      # one-time"
  echo "  voice-coder toggle       # bind this to a global shortcut in your DE"
fi
