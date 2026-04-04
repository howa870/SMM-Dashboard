import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// PORT: required in Replit dev, falls back to 3000 for external builds (Vercel etc.)
const rawPort = process.env.PORT;
const isExternalBuild = !process.env.REPL_ID;
const port = rawPort ? Number(rawPort) : 3000;

if (rawPort && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}
if (!rawPort && !isExternalBuild) {
  throw new Error("PORT environment variable is required but was not provided.");
}

// BASE_PATH: "/" on Vercel, or injected by Replit
const basePath = process.env.BASE_PATH || "/";

// Replit-only plugins — never loaded on Vercel/CI
const replitPlugins: import("vite").Plugin[] = [];
if (process.env.NODE_ENV !== "production" && process.env.REPL_ID) {
  const [{ default: runtimeErrorOverlay }, { cartographer }, { devBanner }] =
    await Promise.all([
      import("@replit/vite-plugin-runtime-error-modal"),
      import("@replit/vite-plugin-cartographer"),
      import("@replit/vite-plugin-dev-banner"),
    ]);
  replitPlugins.push(
    runtimeErrorOverlay(),
    cartographer({ root: path.resolve(import.meta.dirname, "..") }),
    devBanner(),
  );
}

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), ...replitPlugins],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
