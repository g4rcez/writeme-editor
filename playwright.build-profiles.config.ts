import { defineConfig, devices } from "@playwright/test";

const profiles = [
    { name: "macos-app-store", port: 5191, config: "vite.renderer.config.mts", device: "Desktop Chrome" },
    { name: "ios-app-store", port: 5192, config: "packages/mobile/vite.config.ts", device: "iPhone 13" },
    { name: "android-google-play", port: 5193, config: "packages/mobile/vite.config.ts", device: "Pixel 7" },
    { name: "macos-homebrew", port: 5194, config: "vite.renderer.config.mts", device: "Desktop Chrome" },
] as const;

export default defineConfig({
    testDir: "./tests/build-profiles",
    testMatch: "*.spec.ts",
    timeout: 45_000,
    fullyParallel: true,
    workers: 2,
    reporter: "list",
    outputDir: "artifacts/playwright/build-profiles",
    use: { trace: "retain-on-failure" },
    projects: profiles.map((profile) => ({
        name: profile.name,
        use: { ...devices[profile.device], baseURL: `http://127.0.0.1:${profile.port}` },
    })),
    webServer: profiles.map((profile) => ({
        command: `npm run build:profile -- ${profile.name} && npm exec -- vite preview --config ${profile.config} --outDir artifacts/build-profiles/${profile.name} --host 127.0.0.1 --port ${profile.port} --strictPort`,
        env: { WRITEME_BUILD_PROFILE: profile.name },
        url: `http://127.0.0.1:${profile.port}`,
        reuseExistingServer: false,
        timeout: 180_000,
    })),
});
