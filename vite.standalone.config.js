import { readFileSync } from "node:fs";
import base44 from "@base44/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Standalone static build for the offline desktop copy (standalone/desktop).
// Builds a browser-only SPA shell into standalone/desktop/app-dist —
// no Cloudflare worker, so a tiny static server can serve it.
const NOT_PREBUNDLED = new Set(["react", "react-dom", "@base44/vite-plugin", "@tanstack/react-start", "@tanstack/react-router", "@tanstack/react-router-ssr-query", "tailwindcss-animate"]);
const { dependencies } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const PREBUNDLE = Object.keys(dependencies).filter((name) => !NOT_PREBUNDLED.has(name));

export default defineConfig({
  // Marks the build as the offline desktop copy (src/lib/env.js reads this).
  define: { __STANDALONE__: "true" },
  optimizeDeps: { include: PREBUNDLE },
  build: {
    outDir: "standalone/desktop/app-dist",
    emptyOutDir: true,
  },
  plugins: [
    base44({}),
    tanstackStart({
      srcDirectory: "src",
      spa: { enabled: true },
    }),
    react(),
  ],
});