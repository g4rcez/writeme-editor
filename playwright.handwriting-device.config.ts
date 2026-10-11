import { defineConfig } from "@playwright/test";
import path from "node:path";

const artifactDirectory = process.env.PLAYWRIGHT_ARTIFACT_DIR ?? "artifacts/playwright/handwriting-device";

export default defineConfig({
    testDir: "./tests/device",
    testMatch: "freehand-note.spec.ts",
    timeout: 180_000,
    workers: 1,
    retries: 0,
    outputDir: path.join(artifactDirectory, "results"),
    reporter: [
        ["list"],
        ["html", { outputFolder: path.join(artifactDirectory, "report"), open: "never" }],
        ["json", { outputFile: path.join(artifactDirectory, "results.json") }],
    ],
    projects: [{ name: "physical-android", metadata: { physicalDevice: true, runnerPlatform: process.platform } }],
});
