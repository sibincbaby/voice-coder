#!/usr/bin/env bash
# Installs a .desktop launcher so Voice Coder shows up in your app launcher
# and can be bound to a system keyboard shortcut. The launcher opens the UI
# in Chrome's app mode (chromeless window) for a native feel.

set -euo pipefail

BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"
WRAPPER="$BIN_DIR/voice-coder"
APPS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
DESKTOP="$APPS_DIR/voice-coder.desktop"

if [[ ! -x "$WRAPPER" ]]; then
  echo "✗ $WRAPPER not found. Run 'pnpm run install:cli' first." >&2
  exit 1
fi

mkdir -p "$APPS_DIR"

cat > "$DESKTOP" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=Voice Coder
GenericName=Voice typing
Comment=Gemini-powered voice typing dashboard
Exec=$WRAPPER ui --app
Icon=audio-input-microphone
Terminal=false
Categories=Utility;AudioVideo;Audio;
Keywords=voice;dictation;speech;gemini;
StartupNotify=true
SingleMainWindow=true
EOF
chmod +x "$DESKTOP"

# Refresh the application cache so the launcher picks it up immediately
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPS_DIR" >/dev/null 2>&1 || true
fi

echo "✓ Installed: $DESKTOP"
echo
echo "It should appear in your app launcher as 'Voice Coder'."
echo "To bind it to a global keyboard shortcut:"
echo "  • GNOME: Settings → Keyboard → View and Customize Shortcuts → Custom Shortcuts → +"
echo "          Command: $WRAPPER ui --app"
echo "  • KDE:   System Settings → Shortcuts → Custom Shortcuts"
echo "  • Cinnamon: Menu → Preferences → Keyboard → Shortcuts → Custom Shortcuts"
