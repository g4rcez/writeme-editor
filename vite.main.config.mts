import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
    build: {
        rollupOptions: {
            platform: "node",
            external: ["better-sqlite3", "node-pty", "file-type", "bufferutil", "utf-8-validate"],
        },
    },
});
