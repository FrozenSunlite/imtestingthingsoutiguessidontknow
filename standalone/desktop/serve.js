#!/usr/bin/env node
// I'm Trying's Terrific Talent Tree — zero-dependency local server.
// Serves the pre-built editor from app-dist and opens it in your browser.
// No Electron, no npm install, no network needed.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "app-dist", "client");
const SHELL = "_shell.html"; // SPA-mode shell, served for every route
const BASE_PORT = 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

function openBrowser(url) {
  // "error" listener: a missing open command must never crash the server —
  // the address is printed below anyway.
  const ignore = () => {};
  try {
    if (process.platform === "win32") {
      const child = spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" });
      child.on("error", ignore);
      child.unref();
    } else if (process.platform === "darwin") {
      const child = spawn("open", [url], { detached: true, stdio: "ignore" });
      child.on("error", ignore);
      child.unref();
    } else {
      const child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
      child.on("error", ignore);
      child.unref();
    }
  } catch {
    /* the address is printed below anyway */
  }
}

if (!fs.existsSync(path.join(ROOT, SHELL))) {
  console.error("Could not find the editor files (app-dist/client/_shell.html).");
  console.error("Make sure this script stays next to the app-dist folder.");
  process.exit(1);
}

function start(port, attemptsLeft) {
  const server = http.createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    } catch {
      urlPath = "/";
    }
    const filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }
    let target = filePath;
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      target = path.join(ROOT, SHELL); // SPA fallback
    }
    const type = MIME[path.extname(target).toLowerCase()] || "application/octet-stream";
    fs.readFile(target, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
      res.end(data);
    });
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && attemptsLeft > 0) {
      start(port + 1, attemptsLeft - 1);
    } else {
      console.error(`Could not open port ${port}: ${err.message}`);
      process.exit(1);
    }
  });

  server.listen(port, "127.0.0.1", () => {
    const url = `http://localhost:${port}`;
    console.log("");
    console.log("  I'm Trying's Terrific Talent Tree is running:");
    console.log(`  ${url}`);
    console.log("");
    console.log("  It should open in your browser automatically.");
    console.log("  Keep this window open while you play -");
    console.log("  close it (or press Ctrl+C) to stop the editor.");
    console.log("");
    openBrowser(url);
  });
}

start(BASE_PORT, 20);