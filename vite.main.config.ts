import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    rollupOptions: {
      external: [
        "better-sqlite3",
        "node-pty",
        "update-electron-app",
        "elysia",
        "@elysiajs/node",
        "@elysiajs/cors",
        "@sinclair/typebox",
        "puppeteer-core",
      ],
    },
  },
});
