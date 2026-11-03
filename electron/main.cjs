// Windows desktop shell for the existing web app. Electron bundles Chromium,
// so the program no longer depends on Edge, Chrome, Opera or any other browser
// installed on the machine.
//
// The existing PowerShell server still owns the data APIs (image uploads,
// 5eTools, sticker library, project files). It is started hidden on the same
// localhost origin the standalone launcher uses.
const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = 4173;
const APP_URL = `http://localhost:${PORT}`;
const APP_ID = "com.frozensunlite.talenttree.desktop";

let mainWindow = null;
let serverProcess = null;
let quitting = false;

const isPackaged = app.isPackaged;
const resourceRoot = isPackaged ? process.resourcesPath : path.join(__dirname, "..");
const serverRoot = isPackaged
  ? path.join(resourceRoot, "server")
  : path.join(resourceRoot, "standalone");
const serveScript = path.join(serverRoot, "Serve.ps1");
const iconPath = isPackaged
  ? path.join(resourceRoot, "icon.png")
  : path.join(resourceRoot, "public", "icons", "icon-512.png");
const dataRoot = path.join(app.getPath("userData"), "data");

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

  // A deterministic smoke-test hook used by the build script on this machine.
  if (process.env.TTT_SCREENSHOT) {
    mainWindow.webContents.once("did-finish-load", async () => {
      await wait(4000);
      try {
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
