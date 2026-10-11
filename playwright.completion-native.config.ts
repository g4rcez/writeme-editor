import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/native",
    testMatch: "editor-completion.spec.ts",
    workers: 1,
    timeout: 90_000,
    outputDir: "artifacts/playwright/autocomplete-native/results",
    reporter: [["list"], ["json", { outputFile: "artifacts/playwright/autocomplete-native/results.json" }]],
    use: { trace: "retain-on-failure" },
});
