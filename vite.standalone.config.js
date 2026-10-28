import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Standalone static build for the offline desktop copy (standalone/desktop).
// Builds a browser-only SPA shell into standalone/desktop/app-dist — no server
// worker, so the tiny PowerShell server can serve it.
const srcDir = fileURLToPath(new URL("./src", import.meta.url));
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
  server: {
    watch: {
      ignored: ["**/standalone/desktop/userdata/**"],
    },
  },
  build: {
    outDir: "standalone/desktop/app-dist",
    emptyOutDir: true,
  },
  plugins: [
    tanstackStart({
      srcDirectory: "src",
      spa: { enabled: true },
    }),
    react(),
  ],
});
