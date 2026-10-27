#!/bin/bash
# Terrific Talent Tree — double-click launcher (macOS) / run in a terminal (Linux).
cd "$(dirname "$0")/desktop" || exit 1
if ! command -v node >/dev/null 2>&1; then
  MSG="Node.js 18 or newer is required — get it free from https://nodejs.org"
  echo "$MSG"
  if command -v osascript >/dev/null 2>&1; then
    osascript -e "display dialog \"$MSG\" with title \"Terrific Talent Tree\"" >/dev/null 2>&1
  fi
  exit 1
fi
node serve.js