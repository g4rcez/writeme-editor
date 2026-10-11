import { defineConfig, devices, type Project } from "@playwright/test";
import path from "node:path";
import base from "./playwright.config";

const artifactDirectory = process.env.PLAYWRIGHT_ARTIFACT_DIR ?? "artifacts/playwright/handwriting";
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

function profile(name: string, deviceName: string, platform: string): Project {
    const device = devices[deviceName];
    if (!device) throw new Error(`Unknown Playwright device: ${deviceName}`);
    return {
        name,
        metadata: {
            requestedPlatform: platform,
            runnerPlatform: process.platform,
            device: deviceName,
            emulatedDevice: device.isMobile,
        },
        grepInvert: device.defaultBrowserType === "chromium" ? undefined : /@chromium-input/,
        use: {
            ...device,
            userAgent: device.isMobile ? device.userAgent : undefined,
            video: { mode: "on", size: device.viewport },
        },
    };
}

export default defineConfig({
    ...base,
    timeout: 60_000,
    retries: 0,
    testMatch: "freehand-note.spec.ts",
    outputDir: path.join(artifactDirectory, "results"),
    reporter: [
        ["list"],
        ["html", { outputFolder: path.join(artifactDirectory, "report"), open: "never" }],
        ["json", { outputFile: path.join(artifactDirectory, "results.json") }],
    ],
    use: {
        ...base.use,
        ...(externalBaseUrl ? { baseURL: externalBaseUrl } : {}),
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "on",
    },
    webServer: externalBaseUrl ? undefined : { ...base.webServer, env: { WRITEME_E2E: "true" } },
    projects: [
        profile("desktop-macos", "Desktop Safari", "macOS"),
        profile("desktop-linux", "Desktop Chrome", "Linux"),
        profile("desktop-windows", "Desktop Chrome", "Windows"),
        profile("android-phone", "Pixel 7", "Android"),
        profile("ios-phone", "iPhone 13", "iOS"),
        profile("android-tablet", "Galaxy Tab S4", "Android"),
        profile("ipad", "iPad Pro 11", "iPadOS"),
    ],
});
