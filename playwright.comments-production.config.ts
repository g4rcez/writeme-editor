import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
    ...base,
    testMatch: "note-comments-production.spec.ts",
    outputDir: "artifacts/playwright/comments-production",
    use: { ...base.use, baseURL: "http://localhost:5294", trace: "retain-on-failure" },
    webServer: {
        command: "vite preview --host --port 5294",
        url: "http://localhost:5294",
        reuseExistingServer: false,
        timeout: 30_000,
    },
});
