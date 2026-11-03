// Builds the Android debug APK with a compatible JDK and the Android SDK,
// then copies it into the served client folder and rewrites update.json.
//
// Set JAVA_HOME and ANDROID_HOME (or ANDROID_SDK_ROOT) to override the
// machine-local toolchain paths.
import { existsSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

function javaMajor(home) {
  try {
    const release = readFileSync(join(home, "release"), "utf8");
    const match = release.match(/JAVA_VERSION="(\d+)/);
    return match ? Number(match[1]) : 0;
  } catch {
    return 0;
  }
}

const javaHomes = [
  process.env.JAVA_HOME,
  "E:\\tools\\android-build\\jdk21",
  process.env.USERPROFILE
    ? join(process.env.USERPROFILE, ".jdks", "jdk-21")
    : null,
]
  .filter(Boolean)
  .map((home) => ({ home, major: javaMajor(home) }))
  // AGP 8.13 works with JDK 17-24; prefer 21 for the most predictable build.
  .filter(({ major }) => major >= 17 && major <= 24)
  .sort((a, b) => Number(b.major === 21) - Number(a.major === 21) || b.major - a.major);

const sdkRoots = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  "E:\\tools\\android-build\\android-sdk",
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Android", "Sdk") : null,
]
  .filter(Boolean)
  .filter((root) => existsSync(join(root, "platform-tools")));

if (!javaHomes.length) {
  console.error(
    "No compatible JDK found. Install JDK 21 (or set JAVA_HOME to a JDK 17-24 folder)."
  );
  process.exit(1);
}
if (!sdkRoots.length) {
  console.error(
    "No Android SDK found. Install the SDK (or set ANDROID_HOME to its folder)."
  );
  process.exit(1);
}

const javaHome = javaHomes[0].home;
const sdkRoot = sdkRoots[0];
const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: sdkRoot,
  ANDROID_SDK_ROOT: sdkRoot,
  PATH: [
    join(javaHome, "bin"),
    join(sdkRoot, "platform-tools"),
    process.env.PATH || "",
  ].join(";"),
};

console.log(`[apk] JDK ${javaHomes[0].major}: ${javaHome}`);
console.log(`[apk] SDK: ${sdkRoot}`);

// Keep the Android version in step with package.json. Android needs a
// monotonically increasing integer versionCode (1.0.2 -> 10002).
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const parts = String(pkg.version)
  .split(/[.+-]/)
  .map((part) => Number(part) || 0);
const versionCode = parts[0] * 10000 + parts[1] * 100 + parts[2];
const versionName = pkg.version;
console.log(`[apk] version ${versionName} (${versionCode})`);

execFileSync(
  "cmd.exe",
  [
    "/c",
    "gradlew.bat",
    "assembleDebug",
    `-PappVersionCode=${versionCode}`,
    `-PappVersionName=${versionName}`,
  ],
  {
    cwd: join(process.cwd(), "android"),
    stdio: "inherit",
    env,
  }
);

const apkPath = join(
  process.cwd(),
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk"
);
const apkMb = statSync(apkPath).size / 1024 / 1024;
if (apkMb > 80) {
  console.error(
    `APK is ${apkMb.toFixed(1)} MB - desktop installers or downloads were probably bundled. ` +
      "Run npm run apk:prepare again after checking the client folder."
  );
  process.exit(1);
}
console.log(`[apk] ${apkMb.toFixed(1)} MB`);

execFileSync(process.execPath, [join("scripts", "publish-apk.mjs")], {
  stdio: "inherit",
  env,
});
