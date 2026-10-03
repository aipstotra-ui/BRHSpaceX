import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import cesium from "vite-plugin-cesium";

const root = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const cesiumPackage = path.dirname(require.resolve("cesium/package.json"));
const cesiumBuildRoot = path.join(cesiumPackage, "Build");

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    cesium({
      cesiumBuildRootPath: cesiumBuildRoot,
      cesiumBuildPath: path.join(cesiumBuildRoot, "Cesium"),
    }),
  ],
  resolve:
    command === "serve"
      ? {
          alias: {
            "@3rok/cesium-plugin": path.resolve(root, "../lolplol/cesium-plugin/src/index.ts"),
          },
        }
      : undefined,
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
}));
