// Rebuilds public/sounds/manifest.json from the audio files in that folder.
// Names come from the filename, so "dice-roll.ogg" becomes "dice-roll".
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const folder = "public/sounds";
const audioExts = new Set([".wav", ".mp3", ".ogg", ".flac", ".m4a", ".aac", ".opus"]);

if (!existsSync(folder)) {
  console.error(`Missing ${folder}.`);
  process.exit(1);
}

const sounds = readdirSync(folder)
  .filter((name) => audioExts.has(extname(name).toLowerCase()))
  .sort((a, b) => a.localeCompare(b))
  .map((name) => ({
    name: name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim(),
    file: `/sounds/${name}`,
  }));

writeFileSync(join(folder, "manifest.json"), `${JSON.stringify({ sounds }, null, 2)}\n`);
console.log(`Wrote ${join(folder, "manifest.json")} with ${sounds.length} effects.`);
