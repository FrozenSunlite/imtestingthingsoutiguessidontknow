// Publish the signed APK and update.json to the stable, binary-only gist used
// by the Android update checker. The source repository stays private; the gist
// is public and contains only the APK and update manifest.
//
// Uses GITHUB_TOKEN when set, otherwise the local git credential helper.
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const GIST_ID = "d8d5810880985fb22e4b315a68020ee9";
const RAW_BASE = `https://gist.githubusercontent.com/FrozenSunlite/${GIST_ID}/raw`;
const apk = join("android", "app", "build", "outputs", "apk", "release", "app-release.apk");
const updateFile = join("standalone", "desktop", "app-dist", "client", "update.json");

if (!existsSync(apk)) {
  console.error(`Missing ${apk}. Run npm run apk:build first.`);
  process.exit(1);
}
if (!existsSync(updateFile)) {
  console.error(`Missing ${updateFile}. Run npm run apk:build first.`);
  process.exit(1);
}

function readPassword(text) {
  const match = String(text || "").match(/^password=(.+)$/m);
  return match ? match[1].trim() : "";
}

function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  const input = "protocol=https\nhost=github.com\n\n";
  // Git Credential Manager can block on an interactive prompt in a headless
  // build. Prefer the plain Windows credential helper when it is available.
  if (process.platform === "win32") {
    try {
      const execPath = execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim();
      const wincred = join(execPath, "git-credential-wincred.exe");
      if (existsSync(wincred)) {
        const out = execFileSync(wincred, ["get"], {
          input,
          encoding: "utf8",
          stdio: ["pipe", "pipe", "ignore"],
          timeout: 10000,
        });
        const password = readPassword(out);
        if (password) return password;
      }
    } catch {
      /* fall through */
    }
  }
  try {
    const out = execFileSync("git", ["credential", "fill"], {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
      timeout: 15000,
      env: { ...process.env, GCM_INTERACTIVE: "never", GIT_TERMINAL_PROMPT: "0" },
    });
    return readPassword(out);
  } catch {
    return "";
  }
}

const token = githubToken();
if (!token) {
  console.error("No GitHub token. Set GITHUB_TOKEN or sign in with git first.");
  process.exit(1);
}

const update = JSON.parse(readFileSync(updateFile, "utf8"));
const manifest = { ...update, apk: `${RAW_BASE}/TalentTree.apk` };
const tmp = mkdtempSync(join(tmpdir(), "ttt-gist-"));
try {
  execFileSync("git", ["clone", "--depth", "1", `https://gist.github.com/${GIST_ID}.git`, tmp], {
    stdio: "inherit",
  });
  copyFileSync(apk, join(tmp, "TalentTree.apk"));
  writeFileSync(join(tmp, "update.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  execFileSync("git", ["-C", tmp, "add", "TalentTree.apk", "update.json"], { stdio: "inherit" });
  execFileSync(
    "git",
    [
      "-C",
      tmp,
      "-c",
      "user.name=Talent Tree",
      "-c",
      "user.email=talenttree@local",
      "commit",
      "-m",
      `Publish Android ${manifest.version || manifest.builtAt}`,
    ],
    { stdio: "inherit" }
  );
  const remote = `https://x-access-token:${token}@gist.github.com/${GIST_ID}.git`;
  execFileSync("git", ["-C", tmp, "push", "--force", remote, "HEAD:main"], {
    stdio: "inherit",
  });
  console.log(`published APK -> ${RAW_BASE}/TalentTree.apk`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
