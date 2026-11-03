// Windows desktop shell for the existing web app. Electron bundles Chromium,
// so the program no longer depends on Edge, Chrome, Opera or any other browser
// installed on the machine.
//
// The existing PowerShell server still owns the data APIs (image uploads,
// 5eTools, sticker library, project files). It is started hidden on the same
// localhost origin the standalone launcher uses.
const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require("electron");
const { spawn, execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");

const PORT = 4173;
const APP_URL = `http://localhost:${PORT}`;
const APP_ID = "com.frozensunlite.talenttree.desktop";
// The desktop app serves its own update feed from localhost, so updates work
// without a tunnel, a website or an external browser.
const DEFAULT_UPDATE_URL = "http://localhost:4173";

let mainWindow = null;
let serverProcess = null;
let quitting = false;
let tutorialOpen = false;
let autoCheckPending = false;
let updateChecking = false;
let updateDownloading = false;
let desktopUpdateUrl = DEFAULT_UPDATE_URL;

const isPackaged = app.isPackaged;
const resourceRoot = isPackaged ? process.resourcesPath : path.join(__dirname, "..");
const serverRoot = isPackaged
  ? path.join(resourceRoot, "server")
  : path.join(resourceRoot, "standalone");
const serveScript = path.join(serverRoot, "Serve.ps1");
const iconPath = isPackaged
  ? path.join(resourceRoot, "icon.png")
  : path.join(resourceRoot, "public", "icons", "icon-512.png");
// Use the product name for the profile and server data so the documented
// %APPDATA%\Talent Tree paths are the ones actually used.
app.setPath("userData", path.join(app.getPath("appData"), "Talent Tree"));

const dataRoot = path.join(app.getPath("userData"), "data");
const updateConfigPath = path.join(dataRoot, "desktop-update.json");

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function loadUpdateUrl() {
  try {
    const stored = JSON.parse(fs.readFileSync(updateConfigPath, "utf8"));
    if (stored?.url) desktopUpdateUrl = normalizeUrl(stored.url);
  } catch {
    /* first run: keep the compiled default */
  }
  const env = normalizeUrl(process.env.TTT_DESKTOP_UPDATE_URL);
  if (env) desktopUpdateUrl = env;
  desktopUpdateUrl = normalizeUrl(desktopUpdateUrl);
}

function saveUpdateUrl(value) {
  const url = normalizeUrl(value);
  desktopUpdateUrl = url || DEFAULT_UPDATE_URL;
  try {
    fs.mkdirSync(dataRoot, { recursive: true });
    if (!url) fs.rmSync(updateConfigPath, { force: true });
    else fs.writeFileSync(updateConfigPath, JSON.stringify({ url }, null, 2));
  } catch {
    /* an unwritable config must not break updates this session */
  }
}

function versionParts(value) {
  return String(value || "")
    .split(/[.+-]/)
    .map((part) => Number(part) || 0);
}

function isNewerVersion(remote, local) {
  const a = versionParts(remote);
  const b = versionParts(local);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

function requestStream(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const client = /^https:/i.test(url) ? https : http;
    const request = client.get(
      url,
      {
        headers: {
          "Cache-Control": "no-store",
          "User-Agent": `TalentTreeDesktop/${app.getVersion()}`,
        },
      },
      (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location &&
          redirects < 5
        ) {
          response.resume();
          const next = new URL(response.headers.location, url).toString();
          requestStream(next, redirects + 1).then(resolve, reject);
          return;
        }
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`Update host returned ${response.statusCode}`));
          return;
        }
        resolve(response);
      }
    );
    request.setTimeout(60000, () => request.destroy(new Error("Update request timed out")));
    request.on("error", reject);
  });
}

async function fetchJson(url) {
  const response = await requestStream(url);
  return new Promise((resolve, reject) => {
    let body = "";
    response.setEncoding("utf8");
    response.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        response.destroy();
        reject(new Error("Update manifest is too large"));
      }
    });
    response.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Update manifest is not valid JSON"));
      }
    });
    response.on("error", reject);
  });
}

function downloadFile(url, destination, onProgress) {
  return new Promise((resolve, reject) => {
    requestStream(url)
      .then((response) => {
        const total = Number(response.headers["content-length"]) || 0;
        let received = 0;
        const hash = crypto.createHash("sha512");
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        const file = fs.createWriteStream(destination);
        response.on("data", (chunk) => {
          received += chunk.length;
          hash.update(chunk);
          if (onProgress) onProgress(received, total);
        });
        response.pipe(file);
        file.on("finish", () => {
          file.close(() => resolve(hash.digest("base64")));
        });
        file.on("error", reject);
        response.on("error", reject);
      })
      .catch(reject);
  });
}

function updateDialog(options) {
  return mainWindow
    ? dialog.showMessageBox(mainWindow, options)
    : dialog.showMessageBox(options);
}

async function installDownloadedUpdate(manifest, base) {
  const fileUrl = /^https?:\/\//i.test(manifest.url)
    ? manifest.url
    : `${base}${manifest.url.startsWith("/") ? "" : "/"}${manifest.url}`;
  const destination = path.join(
    app.getPath("temp"),
    "TalentTreeUpdate",
    `TalentTree-${manifest.version}.exe`
  );
  updateDownloading = true;
  try {
    mainWindow?.setProgressBar(0);
    const sha512 = await downloadFile(fileUrl, destination, (received, total) => {
      if (total && mainWindow) mainWindow.setProgressBar(received / total);
    });
    mainWindow?.setProgressBar(-1);
    if (manifest.sha512 && sha512 !== manifest.sha512) {
      throw new Error("Downloaded installer failed its checksum.");
    }
    const ready = await updateDialog({
      type: "info",
      title: "Update ready",
      message: `Talent Tree ${manifest.version} is ready to install.`,
      detail: "The app will close, install the update, and reopen. Project data stays on this device.",
      buttons: ["Later", "Restart and install"],
      defaultId: 1,
      cancelId: 0,
    });
    if (ready.response !== 1) return;
    const singleQuote = (value) => `'${String(value).replace(/'/g, "''")}'`;
    const updateDir = path.join(app.getPath("temp"), "TalentTreeUpdate");
    const logFile = path.join(updateDir, "install.log");
    const scriptPath = path.join(updateDir, "apply-update.ps1");
    // Run the installer from a tiny script rather than a -Command string: it
    // avoids nested quoting and survives this process exiting.
    const helper = [
      "$ErrorActionPreference = 'SilentlyContinue'",
      `"helper started $(Get-Date -Format o)" | Out-File -FilePath ${singleQuote(logFile)} -Append`,
      // The app must release its own EXE/DLLs before NSIS replaces them, so
      // wait for this exact process to exit instead of guessing a delay.
      `Wait-Process -Id ${process.pid} -Timeout 45`,
      "Start-Sleep -Milliseconds 600",
      `$installer = Start-Process -FilePath ${singleQuote(destination)} -ArgumentList '/S' -Wait -PassThru`,
      `"installer exit $($installer.ExitCode)" | Out-File -FilePath ${singleQuote(logFile)} -Append`,
      "Start-Sleep -Milliseconds 600",
      `Start-Process -FilePath ${singleQuote(process.execPath)}`,
      `"relaunched $(Get-Date -Format o)" | Out-File -FilePath ${singleQuote(logFile)} -Append`,
    ].join("\r\n");
    fs.mkdirSync(updateDir, { recursive: true });
    fs.writeFileSync(scriptPath, helper, "utf8");
    // `cmd /c start` fully detaches the helper; a directly spawned child can be
    // torn down together with Electron before it runs the installer.
    spawn(
      "cmd.exe",
      [
        "/c",
        "start",
        "",
        "/min",
        "powershell.exe",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-WindowStyle",
        "Hidden",
        "-File",
        scriptPath,
      ],
      { detached: true, stdio: "ignore", windowsHide: true }
    ).unref();
    quitting = true;
    stopServer();
    app.quit();
  } catch (error) {
    mainWindow?.setProgressBar(-1);
    await updateDialog({
      type: "error",
      title: "Update failed",
      message: "The update could not be downloaded or verified.",
      detail: String(error?.message || error),
    });
  } finally {
    updateDownloading = false;
  }
}

async function checkDesktopUpdates({ manual = false } = {}) {
  if (!app.isPackaged) {
    if (manual) {
      await updateDialog({
        type: "info",
        title: "Updates",
        message: "Update checks are available in the installed desktop build.",
      });
    }
    return;
  }
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    if (manual) {
      await updateDialog({
        type: "info",
        title: "Portable build",
        message: "Automatic updates are only supported in the installed build.",
        detail: "Download the latest installer from the update host to update a portable copy.",
      });
    }
    return;
  }
  if (updateChecking || updateDownloading) return;
  updateChecking = true;
  try {
    const base = normalizeUrl(desktopUpdateUrl);
    if (!base) throw new Error("No update host is configured.");
    const manifest = await fetchJson(`${base}/desktop-update.json`);
    if (!manifest?.version || !manifest?.url) {
      throw new Error("The update manifest is missing version or download URL.");
    }
    const local = app.getVersion();
    if (!isNewerVersion(manifest.version, local)) {
      if (manual) {
        await updateDialog({
          type: "info",
          title: "Updates",
          message: "Talent Tree is up to date.",
          detail: `Installed version: ${local}`,
        });
      }
      return;
    }
    const answer = await updateDialog({
      type: "info",
      title: "Update available",
      message: `Talent Tree ${manifest.version} is available.`,
      detail: `You have ${local}. Download it now? The app will download the installer in the background and ask before restarting.`,
      buttons: ["Later", "Download update"],
      defaultId: 1,
      cancelId: 0,
    });
    if (answer.response === 1) await installDownloadedUpdate(manifest, base);
  } catch (error) {
    if (manual) {
      await updateDialog({
        type: "error",
        title: "Update check failed",
        message: "Could not check for updates.",
        detail: String(error?.message || error),
      });
    }
  } finally {
    updateChecking = false;
  }
}

ipcMain.on("talent:set-update-url", (_event, url) => saveUpdateUrl(url));
ipcMain.on("talent:check-updates", () => checkDesktopUpdates({ manual: true }));
ipcMain.on("talent:tutorial-open", (_event, open) => {
  tutorialOpen = !!open;
  if (!tutorialOpen && autoCheckPending) {
    autoCheckPending = false;
    checkDesktopUpdates({ manual: false });
  }
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForServer(timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const attempt = () => {
      const request = http.get(APP_URL, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) resolve();
        else retry();
      });
      request.setTimeout(1200, () => request.destroy());
      request.on("error", retry);
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error("The local server did not start."));
        return;
      }
      setTimeout(attempt, 250);
    };
    attempt();
  });
}

function startServer() {
  if (!fs.existsSync(serveScript)) {
    throw new Error(`Missing server launcher:\n${serveScript}`);
  }
  fs.mkdirSync(dataRoot, { recursive: true });
  serverProcess = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      serveScript,
      "-NoBrowser",
      "-Port",
      String(PORT),
      "-UserDataRoot",
      dataRoot,
    ],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
  );
  serverProcess.stdout?.on("data", (chunk) => {
    const text = String(chunk);
    if (text.trim()) console.log(`[serve] ${text.trim()}`);
  });
  serverProcess.stderr?.on("data", (chunk) => {
    const text = String(chunk);
    if (text.trim()) console.error(`[serve] ${text.trim()}`);
  });
  serverProcess.on("exit", (code) => {
    serverProcess = null;
    if (!quitting && mainWindow) {
      dialog
        .showMessageBox(mainWindow, {
          type: "error",
          title: "Talent Tree server stopped",
          message: "The local server stopped unexpectedly.",
          detail: `Exit code: ${code ?? "unknown"}`,
        })
        .catch(() => {});
    }
  });
}

function stopServer() {
  if (!serverProcess?.pid) return;
  try {
    execFileSync("taskkill", ["/PID", String(serverProcess.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } catch {
    /* already gone */
  }
  serverProcess = null;
}

function isAppUrl(url) {
  try {
    return new URL(url).origin === APP_URL;
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b1020",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) return { action: "allow" };
    if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(() => {});
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(() => {});
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, description, url) => {
    if (code === -3) return; // aborted by another navigation
    dialog.showErrorBox(
      "Talent Tree could not load",
      `${description || "Unknown error"} (${code})\n${url || APP_URL}`
    );
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadURL(APP_URL).catch((error) => {
    dialog.showErrorBox("Talent Tree could not load", String(error));
  });

  mainWindow.webContents.once("did-finish-load", () => {
    setTimeout(() => {
      if (tutorialOpen) autoCheckPending = true;
      else checkDesktopUpdates({ manual: false });
    }, 4000);
  });

  // Build-machine smoke test: dismiss the first-run tour so the deferred
  // update check can run while a desktop screenshot is captured.
  if (process.env.TTT_TEST_SKIP_TOUR) {
    mainWindow.webContents.once("did-finish-load", async () => {
      await wait(2500);
      await mainWindow.webContents
        .executeJavaScript(
          `(() => {
            const skip = [...document.querySelectorAll("button")].find(
              (button) => button.textContent.trim() === "Skip tutorial"
            );
            skip?.click();
            return !!skip;
          })()`
        )
        .catch(() => {});
    });
  }

  // A deterministic smoke-test hook used by the build script on this machine.
  if (process.env.TTT_SCREENSHOT) {
    mainWindow.webContents.once("did-finish-load", async () => {
      await wait(4000);
      try {
        const info = await mainWindow.webContents.executeJavaScript(
          "({ talentDesktop: typeof window.talentDesktop, electron: /Electron/.test(navigator.userAgent) })"
        );
        console.log("renderer bridge", info);
        const image = await mainWindow.webContents.capturePage();
        fs.writeFileSync(process.env.TTT_SCREENSHOT, image.toPNG());
      } catch (error) {
        console.error("screenshot failed", error);
      }
      app.quit();
    });
  }
}

async function start() {
  app.setAppUserModelId(APP_ID);
  loadUpdateUrl();
  try {
    startServer();
    await waitForServer();
    createWindow();
  } catch (error) {
    stopServer();
    dialog.showErrorBox(
      "Talent Tree could not start",
      `${error?.message || error}\n\nMake sure Windows PowerShell is available.`
    );
    app.quit();
  }
}

const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(start);

  app.on("window-all-closed", () => {
    quitting = true;
    stopServer();
    app.quit();
  });

  app.on("before-quit", () => {
    quitting = true;
    stopServer();
  });

  process.on("exit", stopServer);
}
