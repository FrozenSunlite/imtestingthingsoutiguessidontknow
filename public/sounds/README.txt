Sound effects folder
===================

Drop short effect files here (wav, mp3, ogg, flac, m4a) and either:
- run `npm run sounds:index` if the files are already in the right format, or
- run `npm run sounds:import -- "C:\path\to\sfx"` to convert a folder to
  Ogg Opus and rebuild manifest.json.

The app reads manifest.json at runtime. These names are wired to actions:

  Tap Variant 1–5      generic buttons, tabs, links, checkboxes (random)
  Clicking New         the New project tile
  Creating a Connector linking two nodes (drag, Alt+click, fork, chip)
  Placing a Node       adding a node to the tree
  Unlocking a Node     spending a point on a node
  Pop-Up noise         any dialog opening
  Error                validation errors and uncaught failures
  5e Import Finished   background 5eTools import completed
  Return to Main Menu  every standardized Main Menu button
  Window Resize        looped while a panel/dialog is dragged to resize

Add more effects by dropping files here and editing the mapping in
src/lib/sfx.js.
