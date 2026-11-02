// Stamps the build and writes the update manifests copied into the app.
// Run before every standalone build so the installed app can compare its
// bundled build time with the latest published one.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const builtAt = new Date().toISOString();
const build = { builtAt, version: builtAt };

mkdirSync("public", { recursive: true });
writeFileSync(join("public", "app-version.json"), `${JSON.stringify(build, null, 2)}\n`);

// Stamp the service worker so every build is a real update to the browser; an
// unchanged sw.js would never prompt the installed PWA to update.
const swPath = join("public", "sw.js");
const sw = readFileSync(swPath, "utf8");
writeFileSync(
  swPath,
  sw.replace(/const BUILD = "[^"]*";/, `const BUILD = "${builtAt}";`)
);
console.log(`Wrote build ${builtAt}`);
