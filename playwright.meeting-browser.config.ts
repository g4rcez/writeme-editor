import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 5173);

export default defineConfig({
    ...base,
    testMatch: "meeting-note.spec.ts",
    webServer: {
        command: `vite preview --host --port ${port}`,
        url: `http://localhost:${port}`,
        reuseExistingServer: false,
        timeout: 30_000,
        stdout: "ignore",
        stderr: "pipe",
    },
});
