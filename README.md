# Terrific Talent Tree

A homebrew talent-tree builder and character sheet for D&D 5e. Design node
trees, attach benefits and costs, build a character against them, manage point
pools, run a DM screen, and keep a multi-book rulebook.

The app is a client-side **React 19 / [TanStack Start](https://tanstack.com/start)**
project written in plain JavaScript. Project saves, the rulebook and settings are
stored in IndexedDB (`talent-tree`); legacy `localStorage` copies are migrated on
first launch. When the bundled desktop server is running, imported artwork is
stored as files under the app's user-data folder.

## Download

Prebuilt builds are attached to the [latest GitHub release](../../releases/latest):

| Build | File | Notes |
| --- | --- | --- |
| Windows installer | `TalentTree-Setup-<version>.exe` | Start-menu and desktop shortcuts; supports in-app updates |
| Windows portable | `TalentTree-Portable-<version>.exe` | Single executable; no installer or auto-update |
| Android | `TalentTree-Android-<version>.apk` | Offline web build; debug-signed |

Windows and Android builds are produced from the same web bundle by
`npm run build:all`.

The Windows installer is **not code-signed**, so SmartScreen may ask for
confirmation the first time it runs. The Android APK is **debug-signed**: install
it for personal use, or rebuild it with a release keystore before distributing
it more widely.

The desktop app bundles its own Chromium, so it does not use Edge, Chrome, Opera
or any other browser installed on the machine. Its data lives under
`%APPDATA%\Talent Tree`:

- `%APPDATA%\Talent Tree\data` — uploads, projects, 5eTools cache and the
  desktop update feed
- `%APPDATA%\Talent Tree` — the Electron profile

Data from an older browser-based copy is a different browser profile. Export the
project with **Save / Load** in the old copy, then import that file in the
desktop app.

## Features

- **Tree editor** — node types, connectors, per-node benefits and costs, point
  pools, subtree repeat limits, shared/linked subtrees, character-level and
  tier gates, a percentage-based bulk node-size scaler, zero-point/zero-cost
  bridge nodes that unlock automatically, and a canvas that culls and lowers
  detail for large trees.
- **Reference Library and Index** — a default library seeded from SRD 5.1 and
  5.2, plus optional project-local 5eTools imports. Search results jump to and
  expand the matching entry; duplicate entries are grouped so one copy can be
  kept. Backgrounds, species, deities, objects and traps can be edited in place.
- **Characters** — creator for tree-only, race, class and combined builds; the
  four 2014/2024 class progressions stay separate. Level-up supports
  multiclassing and per-class levels, and the sheet tracks every configured
  point type.
- **World tools** — World Builder (maps, settlements, territory, buildings),
  Room Builder, Dungeon Builder, Architect, quests, and a DM screen.
- **Table tools** — rulebook editor, music and sound-effect controls, and an
  annotated in-app tutorial.
- **Platforms** — native Windows desktop app, installable PWA, and an Android
  APK. Desktop updates prompt before downloading and installing; APK updates
  download and open the installer inside the app.

## SRD content and licensing

The default Reference Library contains only material from the free **System
Reference Document 5.1** and **System Reference Document 5.2**, using entries
flagged `srd` / `srd52` in 5eTools data. Both documents are licensed under
[CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode); the required
attribution appears in **Settings → Help → SRD reference content**, in
`public/srd/README.md`, and in the seed file. No SRD artwork is included.

5eTools imports are optional and project-local: importing extra material is a
per-person choice and is not part of the shipped defaults. 5eTools itself is
MIT-licensed.

The bundled music and sound-effect files are **not** covered by the SRD licence.
Check their own licences before redistributing them with the app.

Regenerate the SRD seed after changing the 5eTools source checkout:

```bash
npm run srd:build -- "E:/path/to/5etools/data"
```

## Development

Requirements:

- Node.js 20 or newer
- Windows for building the Electron installers
- JDK 21 and the Android SDK for the APK

```bash
npm install
npm run dev              # Vite dev server on http://localhost:5173
npm run build            # production web build in dist/
npm run build:standalone # browser build for the desktop launcher
npm test                 # progression and migration unit tests
npm run lint             # ESLint
```

`npm run dev` proxies `/api` and `/images` to the local server. Set
`TTT_API_TARGET` before starting Vite when that server runs elsewhere:

```powershell
$env:TTT_API_TARGET = "http://192.168.1.50:4173"
npm run dev
```

### Windows desktop build

The Electron shell starts the existing PowerShell server hidden on
`http://localhost:4173` and loads it in a native window:

```bash
npm run build:standalone
npx electron-builder --win
npm run desktop:publish   # copies the installer + /desktop-update.json into the served client folder
```

Outputs land in `dist-electron/`: an NSIS installer and a portable executable.
`npm run electron:build` runs the web build, packaging and publish steps
together. `npm run build:all` also refreshes and rebuilds the Android APK so
both platforms ship the same UI.

Auto-updates are supported only in the installed NSIS build, not the portable
build. On startup the app checks `<desktop update URL>/desktop-update.json`
(`http://localhost:4173` by default), verifies the installer's SHA-512 and asks
before restarting. The feed can be served from this PC or pointed at another
host in **Settings → General**.

### Android build

`npm run build:all` rebuilds the web app, the Windows installers and the APK in
one pass. For the Android steps alone:

```bash
npm run build:standalone
npm run apk:prepare   # copies the build into capacitor-web and syncs Capacitor
npm run apk:build     # finds JDK 17-24 and the Android SDK, then packages + publishes
```

`apk:build` looks for a compatible JDK (preferring 21) and the Android SDK via
`JAVA_HOME` and `ANDROID_HOME` / `ANDROID_SDK_ROOT`, then falls back to the
toolchain paths on this machine. It also sets the Android `versionName` and
`versionCode` from `package.json`. `apk:prepare` strips desktop installers and
update files from the packaged client, so they never bloat the APK, and the
build refuses an APK over 80 MB.

The debug APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.
`npm run apk:build` also refreshes the downloadable copy and `update.json` under
`standalone/desktop/app-dist/client/downloads/`. The APK checks
`<update URL>/update.json` on startup, downloads a newer build in the app, and
hands it to the Android installer.

### Media

```bash
npm run music:import -- "C:\path\to\music"
npm run sounds:import -- "C:\path\to\sounds"
npm run sounds:index
```

Default tracks live in `public/music`; `public/music/Custom` is used only while
**Custom music** is enabled. Sound effects live in `public/sounds`; an effect
named `click` is wired to buttons, links, tabs and checkboxes automatically.

## Project layout

| Path | What it holds |
| --- | --- |
| `src/routes/index.jsx` | Main editor screen (canvas, character sheet, DM tools) |
| `src/components/skilltree/` | Launch menu, canvas, node editor, toolbar, settings, tutorial |
| `src/components/rulebook/` | Rulebook editor |
| `src/lib/treeStore.jsx` | Tree, character, pools, library and settings state |
| `src/lib/srdSeed.js` | SRD 5.1/5.2 merge and attribution |
| `src/lib/appUpdates.js` | PWA and native APK update flow |
| `electron/` | Windows desktop shell, preload bridge and updater |
| `standalone/` | PowerShell server, launcher scripts, built app |
| `android/` | Capacitor Android project |
| `scripts/` | Build, publish and content-import helpers |
| `tests/` | Progression and migration unit tests |

## Data and backups

- **Saves:** **Save / Load** writes project JSON and `.gz` bundles. Autosave
  writes to IndexedDB; the JSON export is the portable, durable copy.
- **Images:** uploads are stored under the app's `data/images` folder when the
  bundled server is available, and referenced by short `/images/<file>` paths.
  Exported projects embed referenced images as data URLs, so artwork travels
  with the file.
- **Runtime data:** projects, backups and imported images under
  `standalone/desktop/userdata` are gitignored.
- There is no cloud account or sync; the project stays on the machine running
  the app.

## Tests and linting

```bash
npm test
npm run lint
npm run lint:fix
```

`npm test` runs the pure progression/migration unit tests.
`eslint-plugin-react` is installed so JSX usage counts as variable use.
