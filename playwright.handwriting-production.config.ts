import { defineConfig } from "@playwright/test";
import path from "node:path";
import handwriting from "./playwright.handwriting.config";

const artifactDirectory = process.env.PLAYWRIGHT_ARTIFACT_DIR ?? "artifacts/playwright/handwriting-production";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5181";

export default defineConfig({
    ...handwriting,
    testMatch: [
        "freehand-production.spec.ts",
        "freehand-lifecycle.spec.ts",
        "freehand-pens.spec.ts",
        "freehand-pen-dots.spec.ts",
    ],
    timeout: 60_000,
    retries: 0,
    outputDir: path.join(artifactDirectory, "results"),
    reporter: [
        ["list"],
        ["html", { outputFolder: path.join(artifactDirectory, "report"), open: "never" }],
        ["json", { outputFile: path.join(artifactDirectory, "results.json") }],
    ],
    use: { ...handwriting.use, baseURL },
    webServer: process.env.PLAYWRIGHT_BASE_URL
        ? undefined
        : {
              command: "npm run browser:build && npm exec vite -- preview --host 127.0.0.1 --port 5181 --strictPort",
              url: baseURL,
              reuseExistingServer: false,
              timeout: 120_000,
          },
});
