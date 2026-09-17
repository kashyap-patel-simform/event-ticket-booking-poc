import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
    // Docker Desktop's bind mounts don't reliably forward host file-change events into the
    // container, so file watching falls back to polling there (unnecessary, and slightly
    // heavier, on a native host — hence gated behind DOCKER rather than always on).
    watch: process.env.DOCKER === "true" ? { usePolling: true } : undefined,
  },
});
