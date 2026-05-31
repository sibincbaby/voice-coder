#!/usr/bin/env python3
"""
Voice Coder tray indicator.

Sits in the Cinnamon/Mint panel status area (where wifi/battery/bluetooth
live) and reflects the current recording state by watching a small state
file written by the CLI:

    /tmp/voice-coder-<user>.state   (JSON: {"state": "...", "text": "...", "ts": ...})

States: idle | recording | transcribing

Uses XApp.StatusIcon (the native Mint/Cinnamon tray API). Falls back to
AyatanaAppIndicator3 / AppIndicator3 if XApp isn't available.

Writes its own pid to /tmp/voice-coder-<user>.tray.pid while running so the
CLI can detect it and suppress popup notifications.
"""

import os
import json
import getpass
import signal
import subprocess
import sys
import tempfile

import gi
from gi.repository import GLib

USER = os.environ.get("USER") or getpass.getuser()
TMP = tempfile.gettempdir()
# Prefer the exact paths the CLI passes in (so Node and Python never disagree
# about the temp dir); fall back to computing them the same way the CLI does.
STATE_FILE = os.environ.get("VC_STATE_FILE") or os.path.join(TMP, f"voice-coder-{USER}.state")
PID_FILE = os.environ.get("VC_TRAY_PIDFILE") or os.path.join(TMP, f"voice-coder-{USER}.tray.pid")

# Icon names by state — symbolic names that exist in standard icon themes.
ICONS = {
    "idle":         "audio-input-microphone",
    "recording":    "media-record",
    "transcribing": "content-loading-symbolic",
}
# Fallbacks if a theme lacks the above
ICON_FALLBACKS = {
    "idle":         ["audio-input-microphone-symbolic", "microphone-sensitivity-high", "audio-input-microphone"],
    "recording":    ["media-record-symbolic", "media-playback-stop", "media-record"],
    "transcribing": ["content-loading-symbolic", "view-refresh-symbolic", "emblem-synchronizing"],
}
LABELS = {
    "idle":         "Voice Coder — idle",
    "recording":    "Voice Coder — recording…",
    "transcribing": "Voice Coder — transcribing…",
}

WRAPPER = os.path.join(os.path.expanduser("~"), ".local", "bin", "voice-coder")
VOICE_CODER = WRAPPER if os.path.exists(WRAPPER) else "voice-coder"


def vc(*args):
    """Run a voice-coder subcommand detached."""
    try:
        subprocess.Popen([VOICE_CODER, *args],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         start_new_session=True)
    except Exception as e:
        print(f"[tray] failed to run voice-coder {args}: {e}", file=sys.stderr)


def read_state():
    try:
        with open(STATE_FILE) as f:
            d = json.load(f)
        st = d.get("state", "idle")
        return st if st in ICONS else "idle", d.get("text", "")
    except Exception:
        return "idle", ""


# ----------------------------------------------------------------------------
# Backend: prefer XApp.StatusIcon (native to Cinnamon/Mint)
# ----------------------------------------------------------------------------

def make_xapp_backend():
    gi.require_version("XApp", "1.0")
    gi.require_version("Gtk", "3.0")
    from gi.repository import XApp, Gtk

    icon = XApp.StatusIcon()
    icon.set_name("voice-coder")

    menu = Gtk.Menu()

    def add_item(label, cb):
        mi = Gtk.MenuItem(label=label)
        mi.connect("activate", cb)
        menu.append(mi)
        return mi

    add_item("Toggle recording", lambda *_: vc("toggle"))
    add_item("Cancel recording", lambda *_: vc("cancel"))
    sep = Gtk.SeparatorMenuItem(); menu.append(sep)
    add_item("Open dashboard", lambda *_: vc("ui", "--app"))
    sep2 = Gtk.SeparatorMenuItem(); menu.append(sep2)
    add_item("Quit indicator", lambda *_: shutdown())
    menu.show_all()
    icon.set_secondary_menu(menu)

    # Left-click toggles recording
    def on_activate(status_icon, button, _time):
        if button == 1:  # left click
            vc("toggle")
    icon.connect("activate", on_activate)

    def apply(state, text):
        icon.set_icon_name(pick_icon(state))
        tip = LABELS[state]
        if state == "idle" and text:
            tip = "Voice Coder — last: " + (text[:60] + ("…" if len(text) > 60 else ""))
        icon.set_tooltip_text(tip)

    return apply


def make_appindicator_backend():
    # Ayatana first, then legacy
    AppIndicator = None
    for ns in ("AyatanaAppIndicator3", "AppIndicator3"):
        try:
            gi.require_version(ns, "0.1")
            AppIndicator = __import__("gi.repository", fromlist=[ns])
            AppIndicator = getattr(AppIndicator, ns)
            break
        except Exception:
            continue
    if AppIndicator is None:
        raise RuntimeError("no AppIndicator")
    gi.require_version("Gtk", "3.0")
    from gi.repository import Gtk

    ind = AppIndicator.Indicator.new(
        "voice-coder", pick_icon("idle"),
        AppIndicator.IndicatorCategory.APPLICATION_STATUS)
    ind.set_status(AppIndicator.IndicatorStatus.ACTIVE)

    menu = Gtk.Menu()

    def add_item(label, cb):
        mi = Gtk.MenuItem(label=label)
        mi.connect("activate", cb)
        menu.append(mi)

    add_item("Toggle recording", lambda *_: vc("toggle"))
    add_item("Cancel recording", lambda *_: vc("cancel"))
    menu.append(Gtk.SeparatorMenuItem())
    add_item("Open dashboard", lambda *_: vc("ui", "--app"))
    menu.append(Gtk.SeparatorMenuItem())
    add_item("Quit indicator", lambda *_: shutdown())
    menu.show_all()
    ind.set_menu(menu)

    def apply(state, text):
        ind.set_icon_full(pick_icon(state), LABELS[state])
        ind.set_title(LABELS[state])

    return apply


def pick_icon(state):
    # GLib doesn't tell us easily if a named icon exists; we just return the
    # first candidate and trust the theme to fall back. Standard names chosen.
    return ICONS[state]


# ----------------------------------------------------------------------------
# Lifecycle
# ----------------------------------------------------------------------------

_apply = None
_last = None
loop = None


def poll():
    global _last
    state, text = read_state()
    key = (state, text if state == "idle" else "")
    if key != _last:
        _last = key
        if _apply:
            _apply(state, text)
    return True  # keep polling


def shutdown(*_):
    try:
        if os.path.exists(PID_FILE):
            os.unlink(PID_FILE)
    except Exception:
        pass
    if loop:
        loop.quit()
    else:
        sys.exit(0)


def main():
    global _apply, loop

    # Single-instance guard
    if os.path.exists(PID_FILE):
        try:
            old = int(open(PID_FILE).read().strip())
            os.kill(old, 0)
            print("[tray] already running, exiting.", file=sys.stderr)
            return 0
        except Exception:
            pass  # stale pidfile
    with open(PID_FILE, "w") as f:
        f.write(str(os.getpid()))

    try:
        _apply = make_xapp_backend()
        backend = "XApp.StatusIcon"
    except Exception as e1:
        try:
            _apply = make_appindicator_backend()
            backend = "AppIndicator"
        except Exception as e2:
            print(f"[tray] no tray backend available (XApp: {e1}; AppIndicator: {e2})",
                  file=sys.stderr)
            shutdown()
            return 1
    print(f"[tray] started using {backend}")

    # initial paint + poll the state file 3x/sec
    poll()
    GLib.timeout_add(330, poll)

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, sig, shutdown)
        except Exception:
            signal.signal(sig, lambda *_: shutdown())

    loop = GLib.MainLoop()
    try:
        loop.run()
    finally:
        shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
