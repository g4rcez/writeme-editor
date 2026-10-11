import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/native",
    testMatch: "build-profiles.spec.ts",
    workers: 1,
    timeout: 90_000,
    reporter: "list",
    outputDir: "artifacts/playwright/build-profiles-native",
    use: { trace: "retain-on-failure" },
});
