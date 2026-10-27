# Terrific Talent Tree — Standalone Personal Copy

This is a personal, offline copy of Terrific Talent Tree (a D&D 5e homebrew skill-tree
editor). Once installed it runs entirely on your own machine — no account, no
hosting service. Trees and characters are saved in local storage on the machine
running the copy.

## Requirements

- Node.js 18 or newer: https://nodejs.org (any current LTS works) — needed once,
  only to run or build the desktop launcher.

## Setup — Desktop package (opens in your browser)

The editor ships fully pre-built in `desktop/app-dist/` — no Electron, no npm install,
nothing to download. A tiny local server (`serve.js`) runs it using only
Node.js, and it opens in your browser automatically.

**Easiest: double-click the launcher for your operating system**

- Windows: `Start Terrific Talent Tree.bat`
- macOS: `Start Terrific Talent Tree.command` (if macOS blocks it once, right-click → Open)
- Linux: `start.sh`

The launcher checks for Node.js, starts the local server, and opens the editor
in your browser. Keep the launcher window open while you play; closing it stops
the editor. There is no install step at all — the double-click is all it takes.

**Terminal alternative**: in the `desktop` folder run `node serve.js`.

## Setup — Source archive (runs in your browser)

1. Open a terminal in the unzipped folder and run `npm install`.
2. Run `npm run dev`, then open http://localhost:5173 in your browser.

## Keeping your data safe

- Each copy keeps data in its own browser/computer profile: the hosted app and a
  standalone copy have **separate** save spaces, and two standalone copies do too.
- To move trees or characters between copies, use the in-app Save menu: export a
  tree or character as a JSON file, then import it in the other copy.
- Back up regularly — the JSON export is the durable, future-proof format.

## Works fully offline

- Building and playing trees, characters, point pools, rests, inventory, dice,
  saves and all local export formats.

This copy is for personal use.

Created By I'm Trying :D