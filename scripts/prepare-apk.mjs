// Copies the built standalone client into the folder Capacitor packages into
// the Android app, then syncs the native project. Run after
// `npm run build:standalone`.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  copyFileSync,
} from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const source = join("standalone", "desktop", "app-dist", "client");
const target = "capacitor-web";

if (!existsSync(join(source, "_shell.html"))) {
  console.error(`Missing ${join(source, "_shell.html")}. Run npm run build:standalone first.`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
// Never package the APK download into the app that the APK itself runs.
rmSync(join(target, "downloads"), { recursive: true, force: true });
// The served client also holds the Windows installer/update feed after
// `publish:desktop`; those must never be bundled into the Android app.
for (const name of readdirSync(target)) {
  if (
    name === "desktop-update.json" ||
    name.endsWith(".blockmap") ||
    name.toLowerCase().endsWith(".exe")
  ) {
    rmSync(join(target, name), { force: true });
  }
}
// The SPA entry point is the prerendered shell; the server normally serves it
// for any unknown path, so the packaged app needs it at index.html.
copyFileSync(join(source, "_shell.html"), join(target, "index.html"));

execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["cap", "sync", "android"], {
  stdio: "inherit",
  shell: true,
});
