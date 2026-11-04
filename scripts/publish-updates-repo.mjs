// Mirror the current Windows/Android release into the private build archive.
// This is a storage/mirror step; private GitHub assets cannot be downloaded by
// anonymous Android builds, so beta distribution needs an authenticated or
// public host separately.
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const REPO = "FrozenSunlite/talent-tree-updates";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = pkg.version;
const tag = `v${version}`;
const assets = [
  {
    path: join("standalone", "desktop", "app-dist", "client", `TalentTree-Setup-${version}.exe`),
    name: `TalentTree-Setup-${version}.exe`,
    type: "application/octet-stream",
  },
  {
    path: join("dist-electron", `Talent Tree ${version}.exe`),
    name: `TalentTree-Portable-${version}.exe`,
    type: "application/octet-stream",
  },
  {
    path: join("android", "app", "build", "outputs", "apk", "release", "app-release.apk"),
    name: `TalentTree-Android-${version}.apk`,
    type: "application/vnd.android.package-archive",
  },
  {
    path: join("standalone", "desktop", "app-dist", "client", "update.json"),
    name: "update.json",
    type: "application/json",
  },
];

for (const asset of assets) {
  if (!existsSync(asset.path)) {
    console.error(`Missing ${asset.path}. Build and publish the release first.`);
    process.exit(1);
  }
}

function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  try {
    const execPath = execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim();
    const wincred = join(execPath, "git-credential-wincred.exe");
    if (!existsSync(wincred)) return "";
    const out = execFileSync(wincred, ["get"], {
      input: "protocol=https\nhost=github.com\n\n",
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
      timeout: 10000,
    });
    const match = out.match(/^password=(.+)$/m);
    return match ? match[1].trim() : "";
  } catch {
    return "";
  }
}

const token = githubToken();
if (!token) {
  console.error("No GitHub token. Set GITHUB_TOKEN or sign in with git first.");
  process.exit(1);
}
const headers = {
  Authorization: `token ${token}`,
  Accept: "application/vnd.github+json",
  "User-Agent": "TalentTreeRelease",
};

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

const release =
  (await api(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`).catch(() => null)) ||
  (await api(`https://api.github.com/repos/${REPO}/releases`, {
    method: "POST",
    body: JSON.stringify({
      tag_name: tag,
      name: `Talent Tree ${version}`,
      body: `Private build archive for Talent Tree ${version}.`,
      draft: false,
      prerelease: false,
    }),
  }));

const existing = new Set((release.assets || []).map((asset) => asset.name));
for (const asset of assets) {
  if (existing.has(asset.name)) {
    console.log(`skip ${asset.name}`);
    continue;
  }
  console.log(`uploading ${asset.name}...`);
  const upload = release.upload_url.replace(/\{.*$/, "") + `?name=${encodeURIComponent(asset.name)}`;
  const data = readFileSync(asset.path);
  const response = await fetch(upload, {
    method: "POST",
    headers: { ...headers, "Content-Type": asset.type },
    body: data,
  });
  if (!response.ok) {
    throw new Error(`upload ${asset.name}: ${response.status} ${await response.text()}`);
  }
  console.log(`ok ${asset.name}`);
}

// Keep the public feed manifest on main pointing at this release's versioned
// APK. The raw URL is what the Android app fetches.
const manifestPath = join("standalone", "desktop", "app-dist", "client", "update.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.apk = `https://github.com/${REPO}/releases/latest/download/TalentTree-Android-${version}.apk`;
const existingManifest = await fetch(
  `https://api.github.com/repos/${REPO}/contents/update.json`,
  { headers }
).then((response) => (response.ok ? response.json() : null));
const updateBody = {
  message: `Update Android feed to ${version}`,
  content: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`).toString("base64"),
  branch: "main",
};
if (existingManifest?.sha) updateBody.sha = existingManifest.sha;
const updateResponse = await fetch(
  `https://api.github.com/repos/${REPO}/contents/update.json`,
  {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(updateBody),
  }
);
if (!updateResponse.ok) {
  throw new Error(`update.json: ${updateResponse.status} ${await updateResponse.text()}`);
}
console.log(`feed -> https://raw.githubusercontent.com/${REPO}/main/update.json`);
console.log(`mirrored ${tag} -> https://github.com/${REPO}/releases/tag/${tag}`);
