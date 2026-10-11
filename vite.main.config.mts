import path from "node:path";
import { defineConfig } from "vite";
import { buildFeaturePlugin } from "./build/feature-plugin.mts";
import { desktopProfile } from "./build/profiles.mts";

export default defineConfig({
    plugins: [buildFeaturePlugin(desktopProfile(), "main")],
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "./packages/editor/src") } },
    build: {
        rollupOptions: {
            platform: "node",
            external: ["better-sqlite3", "node-pty", "file-type", "bufferutil", "utf-8-validate"],
        },
    },
});
