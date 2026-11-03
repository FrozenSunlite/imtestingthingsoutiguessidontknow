// Publish the Windows installer and its tiny update manifest into the served
// client folder. The Electron main process reads /desktop-update.json and
// downloads the installer directly.
import crypto from "node:crypto";
import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = pkg.version;
const installer = join("dist-electron", `Talent Tree Setup ${version}.exe`);
const blockmap = `${installer}.blockmap`;
const portable = join("dist-electron", `Talent Tree ${version}.exe`);
const clientDir = join("standalone", "desktop", "app-dist", "client");
const safeName = `TalentTree-Setup-${version}.exe`;

if (!existsSync(installer)) {
  console.error(`Missing ${installer}. Run electron-builder --win first.`);
  process.exit(1);
}

mkdirSync(clientDir, { recursive: true });
copyFileSync(installer, join(clientDir, safeName));
if (existsSync(blockmap)) {
  copyFileSync(blockmap, join(clientDir, `${safeName}.blockmap`));
}
if (existsSync(portable)) {
  mkdirSync(join(clientDir, "downloads"), { recursive: true });
  copyFileSync(portable, join(clientDir, "downloads", "TalentTreePortable.exe"));
}

// Electron serves its packaged files from a read-only resources folder, so the
// update feed lives in the writable per-user data folder instead.
const updateDirs = [
  join("standalone", "desktop", "userdata", "desktop-updates"),
  process.env.APPDATA
    ? join(process.env.APPDATA, "Talent Tree", "data", "desktop-updates")
    : null,
].filter(Boolean);

const sha512 = await new Promise((resolve, reject) => {
  const hash = crypto.createHash("sha512");
  createReadStream(installer)
    .on("data", (chunk) => hash.update(chunk))
    .on("end", () => resolve(hash.digest("base64")))
    .on("error", reject);
});

const manifest = {
  version,
  builtAt: statSync(installer).mtime.toISOString(),
  url: `/${safeName}`,
  sha512,
  size: statSync(installer).size,
};
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
writeFileSync(join(clientDir, "desktop-update.json"), manifestText);

for (const dir of updateDirs) {
  mkdirSync(dir, { recursive: true });
  copyFileSync(installer, join(dir, safeName));
  if (existsSync(blockmap)) {
    copyFileSync(blockmap, join(dir, `${safeName}.blockmap`));
  }
  writeFileSync(join(dir, "desktop-update.json"), manifestText);
}

console.log(`published ${safeName} (${(manifest.size / 1024 / 1024).toFixed(1)} MB)`);
console.log(`manifest -> ${join(clientDir, "desktop-update.json")}`);
for (const dir of updateDirs) console.log(`feed -> ${dir}`);
