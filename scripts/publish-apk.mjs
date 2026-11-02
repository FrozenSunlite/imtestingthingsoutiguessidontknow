// Copies the freshly built debug APK into the served client folder so
// Settings → General can offer it as a download, and into the local userdata
// folder for the launcher. Run after `npm run apk:build`.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
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
