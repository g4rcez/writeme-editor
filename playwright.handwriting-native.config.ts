import { defineConfig } from "@playwright/test";

const artifacts = process.env.PLAYWRIGHT_ARTIFACT_DIR ?? "artifacts/playwright/handwriting-native";

export default defineConfig({
    testDir: "./tests/native",
    testMatch: "freehand-note.spec.ts",
    outputDir: `${artifacts}/results`,
    reporter: [
        ["list"],
        ["html", { outputFolder: `${artifacts}/report`, open: "never" }],
        ["json", { outputFile: `${artifacts}/results.json` }],
    ],
    metadata: { runnerPlatform: process.platform, runnerArchitecture: process.arch },
    workers: 1,
    timeout: 60_000,
    retries: 0,
    forbidOnly: Boolean(process.env.CI),
});
