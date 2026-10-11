import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/native",
    testMatch: "note-comments.spec.ts",
    workers: 1,
    timeout: 60_000,
    outputDir: "artifacts/playwright/comments-native",
    reporter: "list",
    use: { trace: "retain-on-failure" },
});
