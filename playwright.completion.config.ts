import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 5184);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig(base, {
    testMatch: ["editor-completion.spec.ts", "editor-completion-video.spec.ts", "note-links.spec.ts"],
    outputDir: "artifacts/playwright/autocomplete-browser/results",
    reporter: [["list"], ["json", { outputFile: "artifacts/playwright/autocomplete-browser/results.json" }]],
    use: { baseURL },
    webServer: {
        command: `vite --host 127.0.0.1 --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
