# Terrific Talent Tree — Standalone Personal Copy

This is a personal, offline copy of Terrific Talent Tree (a D&D 5e homebrew
talent-tree editor). It runs entirely on your own machine — no account, no
hosting service, no network access. Trees, characters and rulebooks are saved in
the browser's local storage on the machine running the copy.

## Requirements

- **Windows:** none. The launcher runs a hidden PowerShell server that is part
  of Windows.
- **macOS / Linux:** Node.js 18 or newer (<https://nodejs.org>) only for the
  optional `serve.js` launcher. `Serve.ps1` can also be used where PowerShell 7
  is available.

## Starting it

The editor ships fully pre-built in `desktop/app-dist/` — no Electron, no npm
install, nothing to download.

- Windows: `Start Terrific Talent Tree.bat` (or the desktop shortcut). It starts
  `Serve.ps1` on <http://localhost:4173> and opens Edge in fullscreen app mode.
- macOS: `Start Terrific Talent Tree.command` (if macOS blocks it once,
  right-click → Open).
- Linux: `start.sh`.

Only one copy of the local server runs at a time; starting the launcher stops
the previous instance first. Closing the launcher window (Windows) or stopping
the process shuts the editor down.

Imported artwork is written to `desktop/userdata/images/` so it survives
rebuilds of the app. Everything in `userdata/` is per-user data and is not part
of the source repository.

## Running from source

1. In the repository root run `npm install`.
2. `npm run dev`, then open <http://localhost:5173>.
3. `npm run build:standalone` rebuilds `desktop/app-dist/` for the launcher.

## Keeping your data safe

- Each browser profile has its own save space. Two copies — or the same copy in
  two browsers — do not share saves.
- To move trees or characters between copies, use the in-app Save menu: export a
  project as JSON (or a `.gz` bundle), then import it in the other copy.
  Exports embed imported images, and importing re-creates them locally.
- Back up regularly — the JSON export is the durable, future-proof format.

## Works fully offline

Building and playing trees, characters, point pools, rests, inventory, dice,
saves, the rulebook, DM screens and all local export formats.

This copy is for personal use.

Created By I'm Trying :D
