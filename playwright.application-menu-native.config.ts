import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/native",
    testMatch: "application-menu.spec.ts",
    workers: 1,
    timeout: 30_000,
    reporter: "list",
    outputDir: "artifacts/playwright/application-menu-native",
    use: { trace: "retain-on-failure" },
});
