// Imports a folder of licensed music into the app's public/music library.
//
// Usage: node scripts/import-music.mjs "C:\path\to\music"
//   Custom tracks go in <source>\Custom (they are never played by default).
//   Tracks are converted to Ogg Opus so the PWA and APK stay reasonably small.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, join, relative } from "node:path";

const source = process.argv[2];
if (!source || !existsSync(source)) {
  console.error('Usage: node scripts/import-music.mjs "C:\\path\\to\\music"');
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

const outRoot = "public/music";
const audioExts = new Set([".wav", ".mp3", ".ogg", ".flac", ".m4a", ".aac", ".opus"]);
// Tracks deliberately removed from the library. Re-imports must not add them
// back, but the original file in the source folder is left untouched.
const EXCLUDED = new Set(["insomnia"]);
mkdirSync(outRoot, { recursive: true });

const titleFor = (file) =>
  file
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]+$/, "")
    .replace(/[_]+/g, " ")
    .trim();

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (EXCLUDED.has(entry.name.replace(/\.[^.]+$/, "").toLowerCase())) return [];
    return audioExts.has(extname(entry.name).toLowerCase()) ? [full] : [];
});

const outputFor = (file) => {
  const rel = relative(source, file);
  const parts = rel.split(/[\\/]/);
  const isCustom = parts[0].toLowerCase() === "custom";
  const folder = isCustom ? join(outRoot, "Custom") : outRoot;
  mkdirSync(folder, { recursive: true });
  return {
    isCustom,
    target: join(folder, `${titleFor(parts[parts.length - 1])}.ogg`),
  };
};

const files = walk(source);
const converted = [];
for (const file of files) {
  const { isCustom, target } = outputFor(file);
  const fresh = existsSync(target) && statSync(target).mtimeMs >= statSync(file).mtimeMs;
  if (!fresh) {
    console.log(`converting ${relative(source, file)} -> ${relative(process.cwd(), target)}`);
    execFileSync(
      ffmpeg,
      ["-y", "-v", "error", "-i", file, "-map", "0:a:0", "-c:a", "libopus", "-b:a", "96k", "-vbr", "on", target],
      { stdio: "inherit" }
    );
  }
  const name = titleFor(file);
  converted.push({ title: name, file: target.replace(/^public/, "").replace(/\\/g, "/"), custom: isCustom });
}

const defaultTracks = converted.filter((t) => !t.custom);
const customTracks = converted.filter((t) => t.custom);
const manifest = {
  generatedAt: new Date().toISOString(),
  default: defaultTracks.map(({ title, file }) => ({ title, file })),
  custom: customTracks.map(({ title, file }) => ({ title, file })),
};
writeFileSync(join(outRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Wrote ${join(outRoot, "manifest.json")} with ${defaultTracks.length} default and ${customTracks.length} custom tracks.`
);
