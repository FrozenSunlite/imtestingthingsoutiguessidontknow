# Terrific Talent Tree

A homebrew talent-tree builder and character sheet for D&D 5e. Design node trees,
attach benefits and costs, build a character against them, manage point pools,
run a DM screen, and keep a multi-book rulebook — all in the browser.

The app is a client-side React 19 / [TanStack Start](https://tanstack.com/start)
project (plain JavaScript). There is no backend: project saves, the rulebook and
settings live in `localStorage`, and imported artwork is stored as files on the
local machine when running through the bundled desktop launcher.

## Running it

The packaged copy is what most people use:

- **Windows:** double-click the Terrific Talent Tree shortcut (or
  `standalone\Start Terrific Talent Tree.bat`). It starts a hidden PowerShell
  static server on <http://localhost:4173> and opens the editor in Edge app mode.
  No Node.js install is required.
- **macOS / Linux:** run `standalone/Start Terrific Talent Tree.command` or
  `standalone/start.sh`, which use the same `Serve.ps1`/`serve.js` server.

Only one server instance runs at a time: `Serve.ps1` tracks its PID in
`standalone/server.pid` and stops the previous instance before starting.

### Development

```bash
npm install
npm run dev            # Vite dev server on http://localhost:5173
npm run build          # production build (dist/)
npm run build:standalone   # browser-only build into standalone/desktop/app-dist
```

`npm run build:standalone` is the one that feeds the launcher. Rebuild it after
changing app code, then restart the launcher.

## Project layout

| Path | What it holds |
| --- | --- |
| `src/routes/index.jsx` | The main editor screen (tree canvas, character sheet, DM tools) |
| `src/routes/__root.jsx` | Shared document shell |
| `src/components/skilltree/` | Launch menu, canvas, node editor, toolbar, character sheet, DM screens, settings |
| `src/components/rulebook/` | Rulebook editor (books, syntax/render preview, images) |
| `src/lib/treeStore.jsx` | Tree, character, pools, library and settings state + localStorage persistence |
| `src/lib/rulebookStore.js` | Rulebook books, saved with the project |
| `src/lib/imageStore.js` | Image import, project-file storage, export inlining and import rehydration |
| `src/lib/` (others) | Geometry, hotkeys, subtree/upgrade logic, homestead and DM trackers |
| `public/default-node.jpg` | Bundled default node artwork |
| `standalone/` | Launcher scripts, local static server, built app (`desktop/app-dist`) |

## Data and artwork

- **Saves:** the in-app Save/Load menu writes project JSON and `.gz` bundles.
  Saves are per-user and gitignored (`Saves/`, `*.save.json`, `*.project.json`,
  `*.bundle.json`).
- **Images:** imported artwork is uploaded to
  `standalone/desktop/userdata/images` through `POST /api/upload` and referenced
  by a short `/images/<file>` path (also gitignored). Pixel art is rendered with
  `image-rendering: pixelated`.
- **Export/import:** exported projects and bundles embed referenced images as
  data URLs, so artwork travels with the file; importing re-uploads them as
  project files.
- **Backups:** the JSON export is the durable, portable format — use it to move
  trees or characters between machines.

## Linting

```bash
npm run lint
npm run lint:fix
```
