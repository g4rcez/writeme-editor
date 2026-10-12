import { defineConfig } from "@playwright/test";
import mobile from "./playwright.mobile.config";

const port = Number(process.env.PLAYWRIGHT_EXCALIDRAW_WEB_PORT ?? 5190);

export default defineConfig({
    ...mobile,
    timeout: 60_000,
    testMatch: "excalidraw.spec.ts",
    outputDir: "artifacts/playwright/excalidraw-web",
    use: { ...mobile.use, baseURL: `http://localhost:${port}`, serviceWorkers: "block" },
    webServer: {
        command: `npm run browser:build && npm exec -- vite preview --host 127.0.0.1 --port ${port} --strictPort`,
        url: `http://localhost:${port}`,
        reuseExistingServer: false,
        timeout: 180_000,
    },
});
