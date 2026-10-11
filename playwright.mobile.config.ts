import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_MOBILE_PORT ?? 5188);

export default defineConfig({
    testDir: "./tests/mobile",
    fullyParallel: true,
    workers: 2,
    retries: process.env.CI ? 1 : 0,
    reporter: "list",
    outputDir: "artifacts/playwright/mobile",
    use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
    projects: [
        { name: "android-chromium", use: { ...devices["Pixel 7"] } },
        { name: "ios-webkit", use: { ...devices["iPhone 13"] } },
    ],
    webServer: {
        command: `vite preview --config packages/mobile/vite.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
        url: `http://localhost:${port}`,
        reuseExistingServer: false,
        timeout: 120_000,
    },
});
