import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

// Every runtime dependency is bundled at startup, for the browser and the SSR
// server: one first imported mid-session makes Vite re-bundle, and a page
// rendered meanwhile on the server loads a second React.
// Not listed: React itself, the TanStack Start/Router framework (its plugin
// bundles it) and build-time plugins.
const NOT_PREBUNDLED = new Set([
  "react",
  "react-dom",
  "@tanstack/react-start",
  "@tanstack/react-router",
  "tailwindcss-animate",
]);
const { dependencies } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const PREBUNDLE = Object.keys(dependencies).filter((name) => !NOT_PREBUNDLED.has(name));

export default defineConfig({
  resolve: { alias: { "@": srcDir } },
  optimizeDeps: { include: PREBUNDLE },
  environments: { ssr: { optimizeDeps: { include: PREBUNDLE } } },
  // Project saves, backups and imported artwork are runtime files. Watching
  // them makes the dev server crash when the local server holds a file open.
  server: {
    watch: {
      ignored: ["**/standalone/desktop/userdata/**"],
    },
    // The Vite dev server only serves the UI. Proxy the local PowerShell
    // server's data APIs so Reference Index, 5eTools, project saves and
    // imported images work while developing at localhost:5173 too.
    proxy: {
      "/api": {
        target: "http://localhost:4173",
        changeOrigin: true,
      },
      "/images": {
        target: "http://localhost:4173",
        changeOrigin: true,
      },
    },
  },
  plugins: [tanstackStart({ srcDirectory: "src" }), react()],
});
