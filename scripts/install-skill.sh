#!/usr/bin/env bash
# Install the voice-coder skill as a symlink for AI agents.
# Usage:
#   ./install-skill.sh          # interactive menu
#   ./install-skill.sh --all    # install for all detected agents
#   ./install-skill.sh claude copilot

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)/.skill"

# agent-name => skill directory path
declare -A AGENTS=(
  [claude]="$HOME/.claude/skills/voice-coder"
  [copilot]="$HOME/.copilot/skills/voice-coder"
)

install_for() {
  local agent="$1"
  local target="${AGENTS[$agent]}"
  local parent
  parent="$(dirname "$target")"

  if [[ ! -d "$parent" ]]; then
    echo "  [$agent] skill dir not found ($parent) — skipped"
    return
  fi

  if [[ -L "$target" ]]; then
    echo "  [$agent] already linked — updating"
    rm "$target"
  elif [[ -e "$target" ]]; then
    echo "  [$agent] $target exists and is not a symlink — removing"
    rm -rf "$target"
  fi

  ln -s "$SKILL_DIR" "$target"
  echo "  [$agent] linked -> $SKILL_DIR"
}

main() {
  echo "voice-coder skill installer"
  echo "skill source: $SKILL_DIR"
  echo ""

  # Explicit targets passed as args
  if [[ $# -gt 0 ]]; then
    if [[ "$1" == "--all" ]]; then
      for agent in "${!AGENTS[@]}"; do install_for "$agent"; done
    else
      for agent in "$@"; do
        if [[ -z "${AGENTS[$agent]+x}" ]]; then
          echo "  unknown agent '$agent'. Known: ${!AGENTS[*]}"
        else
          install_for "$agent"
        fi
      done
    fi
    return
  fi

  # Interactive menu
  echo "Detected agents:"
  local i=1
  local -a keys=()
  for agent in "${!AGENTS[@]}"; do
    local target="${AGENTS[$agent]}"
    local parent
    parent="$(dirname "$target")"
    local status="not installed"
    [[ -d "$parent" ]] && status="available"
    [[ -L "$target" ]] && status="already linked"
    echo "  $i) $agent  ($status)"
    keys+=("$agent")
    ((i++))
  done

  echo ""
  echo "Enter agent names (space-separated), or 'all', or 'q' to quit:"
  read -r input

  [[ "$input" == "q" || -z "$input" ]] && { echo "Aborted."; exit 0; }

  if [[ "$input" == "all" ]]; then
    for agent in "${!AGENTS[@]}"; do install_for "$agent"; done
  else
    for agent in $input; do
      if [[ -z "${AGENTS[$agent]+x}" ]]; then
        echo "  unknown agent '$agent'"
      else
        install_for "$agent"
      fi
    done
  fi
}

main "$@"
