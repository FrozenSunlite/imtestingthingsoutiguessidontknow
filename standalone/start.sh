#!/bin/bash
# Terrific Talent Tree — launcher for Linux. Run with: sh start.sh
cd "$(dirname "$0")/desktop" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18 or newer is required — get it free from https://nodejs.org"
  exit 1
fi
node serve.js