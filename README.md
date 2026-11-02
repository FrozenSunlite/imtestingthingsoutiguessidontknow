# Terrific Talent Tree

A homebrew talent-tree builder and character sheet for D&D 5e. Design node trees,
attach benefits and costs, build a character against them, manage point pools,
run a DM screen, and keep a multi-book rulebook — all in the browser.

The app is a client-side React 19 / [TanStack Start](https://tanstack.com/start)
project (plain JavaScript). Project saves, the rulebook and settings live in
IndexedDB (`talent-tree`) with legacy `localStorage` copies migrated on first
launch. Imported artwork is stored as files on the local machine when running
through the bundled desktop launcher.

## Running it

The packaged copy is what most people use:

- **Windows:** double-click the Terrific Talent Tree shortcut (or
  `standalone\Start Terrific Talent Tree.bat`). It starts a hidden PowerShell
  static server on <http://localhost:4173> and opens Edge app mode (or Chrome,
  then the default browser). No Node.js install is required.
  The launcher is portable: all paths are relative to its own folder, and
  `paths.json` controls the sticker-library and 5eTools locations.
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

## Feature notes

- **Reference Index** reads local, downloaded or homebrew 5eTools data. Books
  have a chapter reader in the Preview pane; backgrounds, feats, species and
  actions show their 5eTools fields; Weapon Masteries are a seeded 2024 list.
- **Benefits** on a node can be dropped in from Reference Index entries or
  picked from the library, grouped by category. Spell tables support school,
  level, subschool, casting time, duration, save/attack, range, target, area,
  effect and material filters; custom choose/roll tables are also supported.
- **Subtree limits:** each subtree has a repeat-purchase limit (`0` = unlimited);
  the first open counts as the first purchase and later purchases add another
  batch of its granted points.
- **Node types & point types:** the Reference Library's Character & Progression
  section lets you add Node Types (including standalone ones like Dilettante) and
  Point Types. Each point type maps a node type to a currency, adds its own pool
  to the sheet and its own field throughout the Levels tab. Level 0 starting
  values are configured separately from the per-level defaults.
- **Shared subtrees:** any subtree can be saved to a reusable library and loaded
  into another node as a linked shared subtree. Structural edits (nodes,
  connections, names, grants) propagate to every node using that definition,
  while points, purchases and mutual exclusivity stay per node. Unlink makes a
  private copy, and new subtrees can still be created normally.
- **Editable Lore & Creatures:** Backgrounds, Species, Deities, Objects and
  Traps & Hazards can be added, edited and removed from the Reference Library.
- **Imported 5eTools categories:** any imported 5eTools category without a
  dedicated tab (classes, feats, options, gifts, psionics, decks and so on) gets
  its own Reference Library section automatically. Entries keep every imported
  field and can be edited in the form or as raw JSON; every preview also has an
  **All imported fields (JSON)** section. Exact duplicates are skipped on import.
  A **Duplicates** tab groups same-name entries across every imported list so you
  can keep one version or remove individual copies. The Reference Index also has
  an **Import by source** panel for importing every entry with a given source/book
  abbreviation across a category or the whole repository, and the Reference
  Library's **5eTools Imports** tab has a shortcut that opens it with the source
  prefilled.
- **Skills:** Religion uses Wisdom, Technology uses Intelligence, and Presence is
  a Charisma skill for composure, first impressions and social self-presentation.
- **Music & sound effects:** Settings → Audio has separate music and sound-effect
  sliders (music starts at 30%, effects at 50%) and mute buttons. Music shuffles by
  default with a song dropdown, fades out and in over one second, and shows a
  bottom-right “Now Playing - SONG” popup (spinning record, six seconds, can be
  turned off). The next shuffled song is chosen and preloaded while the current
  one plays, so the hand-off at the end of a track is immediate. Tracks live in
  `public/music`; `public/music/Custom` is only used
  when **Custom music** is enabled, and default music is disabled while it is on.
  Rebuild the library after adding files:

  ```bash
  npm run music:import -- "C:\path\to\music"
  npm run sounds:index
  ```

  Sound effects go in `public/sounds`; an effect named `click` is wired to
  buttons, links, tabs and checkboxes automatically. The imported pack also
  provides dedicated taps, node placement/unlock, a swing for connector
  creation, dialog pop-ups, the popup-close X, errors, import completion, the
  standardized **Main Menu** button, and a seamless panel/dialog resize loop
  that pauses when the pointer stops and ends on release.
- **Character Creator:** available from the main menu even before a project
  exists, and the creator itself can import a talent tree. The four tree builds
  (tree only, tree + race, tree + class, all) plus **race + class** with no tree.
  Pick a starting level (1–20); the subclass picker stays disabled until that
  class's subclass level (3 by default, or the imported class tab's first
  subclass feature; 2014 Cleric/Sorcerer/Warlock open at 1, Wizard/Druid at 2).
  Classes and subclasses come from imported 5eTools data (2014 and 2024 editions
  stay separate, and shared subclasses appear under each class that owns them).
  The creator also picks a starting currency and amount. Builds that do not use a
  tree hide the talent-point counters and the tree tabs. Backgrounds only show
  `Feature:`-tagged entries on the Character tab; the full background text is on
  the Fluff tab, backgrounds with choices prompt for one, and an origin feat can
  replace the background.
- **Background 5eTools imports:** imports keep running if you leave the Reference
  Index. A progress card in the bottom-left reports each stage and turns into an
  “Import finished” popup with the entry/tab counts when it completes.
- **Level up:** the level-up dialog chooses which class gains the level, filters
  benefits to that class and subclass, supports multiclassing into another class,
  and keeps per-class levels alongside the total character level.
- **Motion:** main-menu section changes fade through black (one second out, one
  second in). Dialogs pop open from near-zero size and pop closed again when a
  choice is made. The desktop Edit panel slides in only while a node is being
  edited and slides away when nothing is being edited.
- **Installable app:** the build includes a web manifest, icons and an offline
  app-shell service worker, so it can be installed from Chrome on Android
  (or added to the home screen) and launched full-screen. Project data still
  lives in the browser origin's local IndexedDB, so a stable HTTPS address is
  needed for long-term use.
- **Android APK:** Settings → General has a **Download TalentTree.apk** link. The
  APK bundles the same web build through Capacitor and runs fully offline except
  for 5eTools API calls (Reference Index fetching and remote images), which need
  the local server. The APK uses its own app origin, so export a project from the
  browser and import it in the APK to move data across. To rebuild it:

  ```bash
  npm run build:standalone
  npm run apk:prepare     # copies the build into capacitor-web + cap sync
  npm run apk:build       # Android SDK + JDK 21 required
  ```

  The debug APK lands in `android/app/build/outputs/apk/debug/app-debug.apk` and
  `npm run apk:prepare` also refreshes the downloadable copy under
  `standalone/desktop/app-dist/client/downloads/TalentTree.apk`. The debug build
  is debug-signed; use a release keystore before distributing it publicly.
- **Mobile layout:** the launch menu, editor panels, View screen tree drawer and
  Reference Library adapt to phone widths; editing opens as a full-screen panel,
  and the View screen shows skill trees in a closeable drawer.
- **Return nodes:** every subtree starts with a non-investable node named
  “double click to return to the parent node” (only its name is editable).
  Double-clicking it returns to the node the subtree was entered through, at any
  nesting depth.
- **Levels from nodes:** a node can grant character levels while invested. The
  effective level drives tier gates, subtree unlocks, proficiency bonus and the
  per-level talent purchase cap in Levels & Rules.
- **World Builder:** generated buildings can use house artwork with 45° rotation,
  expand their footprint only when neighbouring lots are free, and be nudged to a
  free lot before expanding. Generated maps default to 256×256 spaces, can use a
  fixed size or a seed-driven random size, and the Borders toggle hides the
  coloured national territory as well as its outlines. The map supports selecting
  settlements, adding new ones, painting, moving and deleting with the Edit map
  tools. Landmass scripts (Pangaea, Continents, Archipelago, Islands, Fractal,
  Inland Sea, Lakes, Highlands, Terra, Hemispheres, Big & Small) shape the
  land/water mask, and national borders have irregular noisy edges. The territory
  tool includes a size slider, Grow/Shrink buttons and Randomize border, so
  boundaries can be reshaped without erasing them cell by cell. Building
  population is twice its Bedroom rooms; businesses have no Bedrooms unless they
  are an Inn. People can be added to or removed from the People tab.
- **Room Builder:** a front-page section for designing room shapes and battlefield
  terrain. Saved rooms feed procedural dungeons and kingdom house interiors, and
  the page links both ways with the Architect. It also includes Architect room
  types and dedicated connector rooms. Rooms support floor types, reusable floor
  textures, water, lava, hazards and bridges.
- **Dungeon Builder:** generated liquids run from a start point to one or two end
  points, are at least two cells thick and include a bridge. At most two exterior
  doors are kept on a generated dungeon. The room maker is a focused overlay and
  no longer overlaps the generated map; drag-selecting text on its grid is
  disabled.
- **Quests:** generated quest steps follow a coherent chain from the patron to the
  objective and back, so a hunt always includes confronting the monster, a
  retrieval always introduces the item, and rewards are never pulled from nowhere.
- **Architect:** rented properties cannot add facilities/Bastion rooms or enlarge
  the footprint; business-only rooms need the landlord allowance.
- **Dungeon Builder:** rooms and halls track floors and door connections; the
  front-page **Dungeon Rooms** editor creates/imports room templates, and imported
  objects render on the battle map.

## Development proxy

`npm run dev` serves the UI on `:5173` and proxies `/api` and `/images` to the
local server. Set `TTT_API_TARGET` before starting Vite when that server runs
elsewhere:

```powershell
$env:TTT_API_TARGET = "http://192.168.1.50:4173"
npm run dev
```

The packaged app does not use this proxy: `Serve.ps1` serves the UI and API from
the same origin.

## Data safety

- Take a **Save / Load → export** backup before major edits. Autosave writes to
  IndexedDB; the export is the portable, durable copy.
- Runtime project files, backups and imported images are under
  `standalone/desktop/userdata` (gitignored).
- The app has no cloud account or sync: the project stays on the machine running
  the launcher.



## Linting

```bash
npm run lint
npm run lint:fix
npm test
```

`eslint-plugin-react` is installed so JSX usage counts as variable use. The
remaining warnings are genuine unused imports/arguments; there are no lint
errors. `npm test` runs the pure progression/migration unit tests.
