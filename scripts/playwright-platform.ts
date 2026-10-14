import { defineConfig, devices, type PlaywrightTestConfig, type Project } from "@playwright/test";
import path from "node:path";
import { matchesProject, suites, type Platform, type Suite } from "./e2e-options.mts";

const handwriting = ["freehand-note.spec.ts"];
const production = [
    "freehand-production.spec.ts",
    "freehand-lifecycle.spec.ts",
    "freehand-pens.spec.ts",
    "freehand-pen-dots.spec.ts",
];
const productionOnly = [...production, "note-comments-production.spec.ts", "meeting-note.spec.ts"];
const root = path.resolve(__dirname, "..");

export function platformConfig(platform: Platform, env: NodeJS.ProcessEnv = process.env): PlaywrightTestConfig {
    const suite = env.WRITEME_E2E_SUITE ?? "browser";
    if (!suites.includes(suite as Suite)) throw new Error(`Unknown suite: ${suite}`);
    const selected: string[] = env.WRITEME_E2E_PROJECTS ? JSON.parse(env.WRITEME_E2E_PROJECTS) : [];
    const mobile = platform === "ios" || platform === "android";
    const artifactDirectory = env.PLAYWRIGHT_ARTIFACT_DIR ?? path.join(root, "artifacts/playwright", platform, suite);
    const prebuilt = env.WRITEME_E2E_PREBUILT === "1";
    const port = Number(env.PLAYWRIGHT_PORT ?? (suite === "landing" ? 3100 : suite === "mobile" ? 5188 : 5181));
    const baseURL = env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
    const servers: Exclude<NonNullable<PlaywrightTestConfig["webServer"]>, unknown[]>[] = [];
    const projects: Project[] = [];
    const add = (project: Project): void => {
        if (matchesProject(project.name ?? "", selected)) projects.push(project);
    };
    const deviceProject = (
        name: string,
        deviceName: string,
        testDir: string,
        testMatch: string[],
        url = baseURL,
    ): Project => {
        const device = devices[deviceName];
        if (!device) throw new Error(`Unknown Playwright device: ${deviceName}`);
        return {
            name,
            testDir: path.join(root, "tests", testDir),
            testMatch,
            metadata: {
                requestedPlatform: platform,
                runnerPlatform: process.platform,
                device: deviceName,
                emulatedDevice: device.isMobile,
            },
            grepInvert: device.defaultBrowserType === "chromium" ? undefined : /@chromium-input/,
            use: {
                ...device,
                browserName: device.defaultBrowserType,
                userAgent: device.isMobile ? device.userAgent : undefined,
                baseURL: url,
                video: { mode: "on", size: device.viewport },
            },
        };
    };
    const mobileProjects = (testDir: string, testMatch: string[], tablets: boolean): void => {
        add(
            deviceProject(
                platform === "ios" ? "ios-phone" : "android-phone",
                platform === "ios" ? "iPhone 13" : "Pixel 7",
                testDir,
                testMatch,
            ),
        );
        if (tablets)
            add(
                deviceProject(
                    platform === "ios" ? "ipad" : "android-tablet",
                    platform === "ios" ? "iPad Pro 11" : "Galaxy Tab S4",
                    testDir,
                    testMatch,
                ),
            );
    };
    const preview = (command: string, url = baseURL, serverEnv?: Record<string, string>): void => {
        if (env.PLAYWRIGHT_BASE_URL || projects.length === 0) return;
        servers.push({ command, url, env: serverEnv, reuseExistingServer: false, timeout: 180_000 });
    };

    if (suite === "browser" || suite === "production") {
        if (mobile) {
            mobileProjects("e2e", suite === "browser" ? handwriting : production, true);
            if (suite === "production") {
                const drawing = deviceProject(
                    `${platform}-web-drawing`,
                    platform === "ios" ? "iPhone 13" : "Pixel 7",
                    "mobile",
                    ["excalidraw.spec.ts"],
                );
                drawing.use = { ...drawing.use, serviceWorkers: "block" };
                add(drawing);
            }
        } else {
            const chromium = deviceProject(
                "chromium",
                "Desktop Chrome",
                "e2e",
                suite === "browser" ? ["*.spec.ts"] : [...productionOnly, "vim-settings.spec.ts"],
            );
            if (suite === "browser") chromium.testIgnore = productionOnly;
            if (suite === "production" && platform === "osx")
                chromium.testMatch = [
                    "note-comments-production.spec.ts",
                    "meeting-note.spec.ts",
                    "vim-settings.spec.ts",
                ];
            add(chromium);
            if (platform === "osx")
                add(
                    deviceProject(
                        "desktop-macos",
                        "Desktop Safari",
                        "e2e",
                        suite === "browser" ? handwriting : production,
                    ),
                );
        }
        preview(
            suite === "browser"
                ? `npm exec -- vite --host 127.0.0.1 --port ${port} --strictPort`
                : `${prebuilt ? "" : "npm run browser:build && "}npm exec -- vite preview --host 127.0.0.1 --port ${port} --strictPort`,
        );
    } else if (suite === "mobile") {
        if (!mobile) throw new Error("The mobile suite requires ios or android.");
        mobileProjects("mobile", ["*.spec.ts"], false);
        preview(
            `${prebuilt ? "" : "npm run mobile:build && "}npm exec -- vite preview --config packages/mobile/vite.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
        );
    } else if (suite === "native") {
        if (mobile) throw new Error("Native means desktop Electron, not mobile emulation.");
        add({
            name: `native-${platform}`,
            testDir: path.join(root, "tests/native"),
            testMatch: "*.spec.ts",
            testIgnore: "build-profiles.spec.ts",
        });
    } else if (suite === "profiles") {
        const profiles =
            platform === "osx"
                ? [
                      {
                          name: "macos-app-store",
                          port: 5191,
                          config: "vite.renderer.config.mts",
                          device: "Desktop Chrome",
                      },
                      {
                          name: "macos-homebrew",
                          port: 5194,
                          config: "vite.renderer.config.mts",
                          device: "Desktop Chrome",
                      },
                  ]
                : platform === "ios"
                  ? [
                        {
                            name: "ios-app-store",
                            port: 5192,
                            config: "packages/mobile/vite.config.ts",
                            device: "iPhone 13",
                        },
                    ]
                  : platform === "android"
                    ? [
                          {
                              name: "android-google-play",
                              port: 5193,
                              config: "packages/mobile/vite.config.ts",
                              device: "Pixel 7",
                          },
                      ]
                    : [];
        if (profiles.length === 0) throw new Error("Restricted profile tests exist only for osx, ios and android.");
        for (const profile of profiles) {
            if (!matchesProject(profile.name, selected)) continue;
            const url = `http://127.0.0.1:${profile.port}`;
            add(deviceProject(profile.name, profile.device, "build-profiles", ["*.spec.ts"], url));
            const outDir = env.WRITEME_E2E_PROFILE_DIR ?? `artifacts/build-profiles/${profile.name}`;
            servers.push({
                command: `${prebuilt ? "" : `npm run build:profile -- ${profile.name} && `}npm exec -- vite preview --config ${profile.config} --outDir ${outDir} --host 127.0.0.1 --port ${profile.port} --strictPort`,
                env: { WRITEME_BUILD_PROFILE: profile.name },
                url,
                reuseExistingServer: false,
                timeout: 180_000,
            });
        }
        if (platform === "osx")
            add({
                name: "native-store",
                testDir: path.join(root, "tests/native"),
                testMatch: "build-profiles.spec.ts",
            });
    } else if (suite === "landing") {
        add(deviceProject("chromium", "Desktop Chrome", "", ["landing-downloads.spec.ts"]));
        preview(
            `npm --prefix packages/landing run ${prebuilt ? "start" : "dev"} -- --hostname 127.0.0.1 --port ${port}`,
        );
    } else if (suite === "device") {
        if (platform !== "android")
            throw new Error("Automated physical pen tests require Android; iPad/Pencil checks are operator-run.");
        add({
            name: "physical-android",
            testDir: path.join(root, "tests/device"),
            testMatch: "freehand-note.spec.ts",
            metadata: { physicalDevice: true, runnerPlatform: process.platform },
        });
    }
    if (projects.length === 0) throw new Error(`No ${platform}/${suite} projects match ${selected.join(", ")}.`);
    return defineConfig({
        testDir: path.join(root, "tests"),
        projects,
        webServer: servers.length ? servers : undefined,
        fullyParallel: false,
        workers: 1,
        forbidOnly: Boolean(env.CI),
        retries: 0,
        timeout: suite === "device" ? 180_000 : suite === "native" || suite === "profiles" ? 90_000 : 60_000,
        outputDir: path.join(artifactDirectory, "results"),
        reporter: [
            [env.CI ? "github" : "list"],
            ["html", { outputFolder: path.join(artifactDirectory, "report"), open: "never" }],
            ["json", { outputFile: path.join(artifactDirectory, "results.json") }],
        ],
        metadata: {
            requestedPlatform: platform,
            runnerPlatform: process.platform,
            runnerArchitecture: process.arch,
            suite,
        },
        use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", video: "on" },
    });
}
