import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => ({
  base: command === "build" ? "/frame-board/" : "/",
  server: {
    host: "::",
    port: 8120,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // we handle registration manually with a guard
      devOptions: { enabled: false },
      manifest: false,
      workbox: {
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webp}"],
        // og-image.png is only fetched by social scrapers from the live server,
        // never by the app — keep it out of the offline precache (it also
        // exceeds the 2 MiB precache limit and would fail the build).
        globIgnores: ["**/og-image.png"],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
