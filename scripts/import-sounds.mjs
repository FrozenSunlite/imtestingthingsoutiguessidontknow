// Imports a folder of licensed sound effects into public/sounds and rebuilds
// the manifest. Files are converted to Ogg Opus so the PWA/APK stay small.
//
// Usage: node scripts/import-sounds.mjs "C:\path\to\sfx"
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const source = process.argv[2];
if (!source || !existsSync(source)) {
  console.error('Usage: node scripts/import-sounds.mjs "C:\\path\\to\\sfx"');
  process.exit(1);
}

const ffmpegCandidates = [
  process.env.FFMPEG_PATH,
  "E:\\tools\\ffmpeg\\bin\\ffmpeg.exe",
  "ffmpeg",
].filter(Boolean);
const ffmpeg = ffmpegCandidates.find(
  (candidate) => !candidate.includes("\\") || existsSync(candidate)
);
if (!ffmpeg) {
  console.error("ffmpeg not found. Set FFMPEG_PATH or install ffmpeg on PATH.");
  process.exit(1);
}

const outRoot = "public/sounds";
const audioExts = new Set([".wav", ".mp3", ".ogg", ".flac", ".m4a", ".aac", ".opus"]);
mkdirSync(outRoot, { recursive: true });

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return audioExts.has(extname(entry.name).toLowerCase()) ? [full] : [];
  });

const titleFor = (file) =>
  file
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]+$/, "")
    .replace(/[_]+/g, " ")
    .trim();

const sounds = [];
for (const file of walk(source)) {
  const name = titleFor(file);
  const target = join(outRoot, `${name}.ogg`);
  const fresh = existsSync(target) && statSync(target).mtimeMs >= statSync(file).mtimeMs;
  if (!fresh) {
    console.log(`converting ${file} -> ${target}`);
    execFileSync(
      ffmpeg,
      ["-y", "-v", "error", "-i", file, "-map", "0:a:0", "-c:a", "libopus", "-b:a", "96k", "-vbr", "on", target],
      { stdio: "inherit" }
    );
  }
  sounds.push({ name, file: `/sounds/${name}.ogg` });
}

sounds.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(
  join(outRoot, "manifest.json"),
  `${JSON.stringify({ sounds }, null, 2)}\n`
);
console.log(`Wrote ${join(outRoot, "manifest.json")} with ${sounds.length} effects.`);
