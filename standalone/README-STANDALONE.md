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

- Windows: `Start Terrific Talent Tree.bat` (or `Terrific Talent Tree.lnk`). It
  starts `Serve.ps1` on <http://localhost:4173> and opens Edge in fullscreen app
  mode. If Edge is not installed, it looks for Chrome, then falls back to the
  default browser.
- The launcher resolves every path relative to its own folder. You can move the
  whole folder to another drive or directory and use the `.bat` directly.
- If you move the folder and the `.lnk` stops working, run
  `Repair Shortcuts.bat` beside the project (or `Repair Shortcut.ps1` inside the
  app folder) to recreate it.
- macOS: `Start Terrific Talent Tree.command` (if macOS blocks it once,
  right-click → Open).
- Linux: `start.sh`.

Only one copy of the local server runs at a time; starting the launcher stops
the previous instance first. Closing the launcher window (Windows) or stopping
the process shuts the editor down.

Imported artwork is written to `desktop/userdata/images/` so it survives
rebuilds of the app. Everything in `userdata/` is per-user data and is not part
of the source repository.

### Automatic project files on disk

The working project is saved in the browser and mirrored automatically to:

`standalone/desktop/userdata/projects/`

Each project writes a named `.json` file plus `latest.json`. Manual saves also
create timestamped copies in `projects/backups/` (the newest 30 are kept).
Turn disk autosave off in **Settings → Project** if you do not want the mirror.

The project file stores image references; the actual imported images live in
`userdata/images/`. To move a project between PCs, copy both the JSON and the
`images` folder, or use **Save / Load → Download** to export a single portable
JSON with the images embedded.

### Sticker images are a source, not a dependency

Importing a sticker copies it into `userdata/images/`. After that, the source
folder can be moved, renamed or disconnected without breaking imported stickers,
map textures or floor materials. Only the sticker browser needs the source folder
while you are browsing it. Set or change that folder directly on the **Stickers**
page, or in `userdata/paths.json`.

### Stickers (formerly assets)

Anything placed inside a room is a **sticker**: a purely cosmetic image that can
be moved, resized and rotated inside the room. The **Stickers** page lists every
loaded sticker and every place it is used (rooms, floors, world-map textures and
room-type templates). Click a use to jump to that settlement, building or room.

Stickers are assigned to room parts and floor materials from the settlement
view: **Stickers** opens the layout editor for a room (**Add sticker**, X/Y/W/H,
rotation, **Replace art**, **Remove**, **Auto-arrange**), and **Floor art**
assigns an imported image as that room's floor material. **Use as room-type
template** saves the room's sticker set and floor so every empty room of the same
type in the setting reuses it — procedural interiors therefore share the same
architectural art as the rooms you design by hand.

The **Sticker source folder** panel at the top of the Stickers page lets you type
or browse to a different image library. **Browse...** opens a native folder
picker on the machine running the local server. Imported images are copied into
the project image folder, so moving or disconnecting the source library later
does not break already-placed stickers.

Map artwork is assigned on the same page. **Terrain (map) textures** lists each
biome used by the setting, shows the image it currently draws with, and offers
**Assign**/**Change** and **Clear**. Clicking **Change**, or clicking a map
texture in the loaded-stickers list, targets that terrain; the next image you
pick from the sticker library becomes its map texture. **Auto-fill missing**
imports a matching texture for any biome that does not have one yet. The World
Map's **Edit textures** button jumps straight to this panel.

## World Builder

The World Builder generates and edits a complete setting under
**Settings → library → world**:

- **Setting:** era, theme, scale (kingdom to multiverse), primary realm and
  biomes, with procedural realms/planets/planes, nations, settlements, roads and
  travel times.
- **World map:** zoomable, drag-pannable and editable. Paint terrain or national
  territory, place/move/delete settlements, draw or cut roads, place world
  developments, found a player kingdom, and regenerate terrain or generate new
  settlements procedurally. Imported biome textures, settlement pins, development
  diamonds and city maps are layered on the same map. Manual settlement placement
  creates a blank player settlement; procedural generation fills buildings and
  people. Player kingdoms appear alongside AI kingdoms in the Kingdoms tab.
- **City streets:** an orthogonal street grid, not decorative diagonal lines.
  Roads branch outward on the grid, walls and gates enclose capitals and cities,
  and coastal settlements get water and dock frontage.
- **Building footprints:** every building occupies a square lot sized from the
  Construction Timelines table — Wretched/Squalid 1×1, Poor 2×2, Modest 3×3,
  Comfortable 4×4, Wealthy 5×5, Aristocratic 6×6 — and every lot must touch a
  road tile. Building types have prerequisites (a Guildhall needs a Market Hall,
  a Library needs a Town Hall, and so on), so the generator fills the town in a
  sensible order.
- **Interiors:** each building is a grid of 5-ft. spaces. A central cross
  corridor is cut through the floor, the quadrants become grid-aligned rooms,
  and every room gets a door onto the corridor. Generated houses follow the
  Architect facility class (Cramped 4-room, Roomy 6-room, Vast 8-room scale),
  carry their build time, and always have a ground-floor exterior door with a
  vector line leading outside. Multi-floor buildings have exactly one stair tile
  between each pair of floors. Double-click a building on the settlement map to
  jump straight to its generated interior; the seed used for that iteration stays
  visible, and **Reroll rooms** generates a new layout and seed. Generated
  interiors now use varied, V/R/C-sized rooms rather than uniform quadrants.
  Rooms carry an Architect category (Living, Social, Storage, Business, Bastion,
  Attachment, Connection) and a focus of living, storage or socialization.
  Business buildings draw from the business room set, and a capital's seat of
  government contains Bastion special facilities up to the ruler's level plus a
  4×4 **Seat of Power** Throne Room. The room grid has its own zoom, pan and
  **Fit** controls (mouse wheel or buttons to zoom, drag to pan, double-click to
  reset). The city map and world map also zoom with the mouse wheel. World-map
  terrain uses a square cell grid, so cells are squares rather than stretched
  rectangles.
  Use **Rebuild plan** in a settlement to regenerate the streets and room grids.
- **People:** generated NPC names, ability scores, personalities, homes, jobs
  and hour-by-hour schedules. The living-world clock moves them between home,
  work and the tavern. People can be searched, filtered and sorted by name,
  settlement, occupation or disposition, and each person carries an editable
  disposition badge: allied, friendly, trusting, indifferent, hostile or hated.
- **Kingdoms:** monthly turns with economy, military, influence and prosperity;
  buildings now take 1–5 months by tier; research, decrees, accords, free-trade
  agreements, espionage, trade bluffs, vassalage, caravans and BCR/MP field
  battles that can capture provinces. Counts and stats have **no upper cap**.
  The **Ledger** tab records every settlement's and development's monthly income
  and upkeep, with a running treasury. Player-founded kingdoms start with a
  blank ledger and minimal counts; new player settlements are blank lots until
  you build in them.
- **Events:** every non-“All is well” event is kept in **Recent events**. Events
  with an ongoing effect stay active until resolved or their duration expires.
  Tasks such as Bandit Activity, Bandit Siege, plague, drought, storms and market
  crashes list a goal and can be bought off with the matching resource. The base
  cost is a pool of d6 equal to the capital's comfort tier (Wretched 1 through
  Aristocratic 7), and it rises by 1 for each week the task remains unresolved.
  Positive time-based events remain for their listed number of months. An
  unresolved Bandit Activity halves caravan speed until the roads are cleared.
- **Council:** six roles — Steward, Chancellor, Architect, General, Warden and
  **Counter-Intel** (formerly Spymaster). The Actions tab is grouped into the
  six council portfolios. Appoint any world NPC, the active character, a saved
  character, or import a character export into a council seat.
- **World developments:** separate plots planted on the world map, outside the
  towns and cities. The table includes highways, castles, industrial and
  military encampments, toll booths, lookout towers, walls, villages, towns,
  bridge forts, magical nexuses, sacred groves, trade ports, observation
  balloons, arcanum simulacra, refugee camps, diplomatic enclaves, open markets
  and insurrectionist operations. They cost kingdom counts, take months to
  build, and villages/towns found a new settlement on completion.
- **Quests:** generated quest boards with patrons, rewards, complications and
  steps; accept, advance and complete quests, then stage the fight.
- **Combat:** initiative, a tactical grid, movement in 5-ft. spaces, attack
  rolls against AC, hit points, terrain and computer-controlled enemy turns.
  The encounter is stored in `world.combat`.
- **Foundry export:** the header's **Foundry** button downloads journal entries,
  NPC actors, quests, developments and encounter tables as a `.foundry.json`
  bundle.

The world is part of the normal project file, so it is included in browser
autosave, the filesystem mirror in `userdata/projects/`, and manual exports.

### Play tab

**World Builder → Play** adds the player-facing layer on top of the setting:

- A persistent player party (name, level, gold, pack, journal and location) stored in
  `world.player` and saved with the project.
- **Travel** between settlements. Travel advances the world clock, costs gold and can
  trigger a road encounter from the world's encounter tables.
- **Markets** with buy/sell prices that react to settlement prosperity, biome, supply
  levels and active kingdom events.
- **Downtime** actions: work, carouse, research, craft, fish and train.
- **Rumors** drawn from kingdom events, recent history and local quests.
- **Quest board** with accept / advance / complete actions and gold rewards.
- **Delves** generated from the Dungeon Builder's ranks, scaled to the party level.
  Explore rooms, stage their encounters in the Combat tab, clear rooms for coin and
  finish the delve.
- Road encounters remain pending until you either claim victory after combat or avoid
  them, so the result is not lost when switching tabs.

### World Health tab

**World Builder → World Health** validates map grids, room bounds, overlaps, doors,
stairs, exterior doors, capital seats, ruler levels, dispositions, active-event data
and legacy image links. **Repair world** runs the safe upgrade pass and regenerates any
interior that fails the structural checks without touching local images or project
assets.

### Autosave safety

The filesystem mirror no longer writes a completely empty launch over an existing
project. Manual saves keep the previous file as a backup, and an autosave that is less
than half the size of the file it replaces also snapshots the old file in
`userdata/projects/backups/` first. If a project ever looks empty, stop and check that
folder before saving again.

## Moving to another PC / drive

The app folder is portable. After moving it:

1. Start with `Start Terrific Talent Tree.bat` from the app folder or the
   folder above it.
2. If you want the shortcut back, run `Repair Shortcuts.bat`.
3. If your sticker library or 5eTools data are somewhere else, edit
   `standalone/desktop/userdata/paths.json`:
   ```json
   {
     "assetRoot": "D:\\Sticker Library",
     "fiveTools": "E:\\5etools"
   }
   ```
   Environment variables `TALENT_TREE_ASSET_ROOT` and
   `TALENT_TREE_5ETOOLS` override that file.

Your tree/character project data still lives in the browser profile used by
the launcher. Moving the program folder does not move browser storage; export a
project bundle from Save / Load before changing browsers or PCs.

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
saves, the rulebook, DM screens, world building, kingdom turns, quests,
tactical combat and all local export formats.

This copy is for personal use.

Created By I'm Trying :D
