// Copies the freshly built debug APK into the served client folder so
// Settings → General can offer it as a download, and into the local userdata
// folder for the launcher. Run after `npm run apk:build`.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const apk = join("android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
if (!existsSync(apk)) {
  console.error(`Missing ${apk}. Run npm run apk:build first.`);
  process.exit(1);
}

const targets = [
  join("standalone", "desktop", "app-dist", "client", "downloads", "TalentTree.apk"),
  join("standalone", "desktop", "userdata", "apk", "TalentTree.apk"),
];

for (const target of targets) {
  mkdirSync(join(target, ".."), { recursive: true });
  copyFileSync(apk, target);
  console.log(`copied -> ${target}`);
}

// Advertise the update only when there is a matching APK to download. Read the
// stamp that was packaged *inside* the APK (the copied Android assets), not the
// newer web-only client build; otherwise the app would keep offering the same
// APK because update.json was ahead of the installed build.
const clientDir = join("standalone", "desktop", "app-dist", "client");
const packagedVersionFile = join(
  "android",
  "app",
  "src",
  "main",
  "assets",
  "public",
  "app-version.json"
);
const versionFile = existsSync(packagedVersionFile)
  ? packagedVersionFile
  : join(clientDir, "app-version.json");
const build = existsSync(versionFile)
  ? JSON.parse(readFileSync(versionFile, "utf8"))
  : { builtAt: new Date().toISOString() };
writeFileSync(
  join(clientDir, "update.json"),
  `${JSON.stringify({ ...build, apk: "/downloads/TalentTree.apk" }, null, 2)}\n`
);
console.log(`updated -> ${join(clientDir, "update.json")}`);

