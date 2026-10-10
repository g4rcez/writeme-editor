import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/native",
    testMatch: "meeting-note.spec.ts",
    workers: 1,
    timeout: 60_000,
    forbidOnly: Boolean(process.env.CI),
    reporter: process.env.CI ? "github" : "list",
    use: { trace: "retain-on-failure" },
});
