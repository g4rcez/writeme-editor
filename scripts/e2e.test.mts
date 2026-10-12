import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { matchesProject, parseE2EArguments } from "./e2e-options.mts";
import { platformConfig } from "./playwright-platform.ts";

const runner = fileURLToPath(new URL("./e2e.mts", import.meta.url));

test("forwards positional selectors and Playwright options while extracting platform/suite", () => {
    assert.deepEqual(
        parseE2EArguments([
            "--platform=osx",
            "--suite",
            "production",
            "tests/e2e/meeting-note.spec.ts",
            "--grep",
            "live local Whisper",
            "--project=chromium",
            "--workers",
            "2",
        ]),
        {
            platform: "osx",
            suite: "production",
            projects: ["chromium"],
            forwarded: [
                "tests/e2e/meeting-note.spec.ts",
                "--grep",
                "live local Whisper",
                "--project",
                "chromium",
                "--workers",
                "2",
            ],
        },
    );
    assert.equal(matchesProject("macos-app-store", ["macos-*"]), true);
    assert.equal(matchesProject("native-store", ["macos-*"]), false);
});

for (const args of [
    [],
    ["--platform", "macos", "--suite", "browser"],
    ["--platform", "ios", "--suite", "native"],
    ["--platform", "linux", "--suite", "mobile"],
    ["--platform", "ios", "--suite", "device"],
    ["--platform", "windows", "--suite", "profiles"],
    ["--platform", "osx", "--suite", "browser", "--config", "other.ts"],
]) {
    test(`rejects unsupported or incomplete selection: ${args.join(" ")}`, () =>
        assert.throws(() => parseE2EArguments(args)));
}

test("native and external device selections start no web servers", () => {
    assert.equal(platformConfig("osx", { WRITEME_E2E_SUITE: "native" }).webServer, undefined);
    assert.equal(platformConfig("android", { WRITEME_E2E_SUITE: "device" }).webServer, undefined);
});

test("production selection builds only the web app and can reuse a prebuilt bundle", () => {
    const fresh = platformConfig("ios", { WRITEME_E2E_SUITE: "production" }).webServer;
    assert.ok(Array.isArray(fresh));
    assert.equal(fresh.length, 1);
    assert.match(fresh[0]!.command, /^npm run browser:build && /);
    assert.doesNotMatch(fresh[0]!.command, /mobile:build|build:profile|package:app/);
    const prebuilt = platformConfig("ios", { WRITEME_E2E_SUITE: "production", WRITEME_E2E_PREBUILT: "1" }).webServer;
    assert.ok(Array.isArray(prebuilt));
    assert.doesNotMatch(prebuilt[0]!.command, /build/);
    assert.equal(
        platformConfig("ios", { WRITEME_E2E_SUITE: "browser", PLAYWRIGHT_BASE_URL: "https://example.test" }).webServer,
        undefined,
    );
});

test("restricting profile projects does not start or build unrelated profile servers", () => {
    const native = platformConfig("osx", { WRITEME_E2E_SUITE: "profiles", WRITEME_E2E_PROJECTS: '["native-store"]' });
    assert.equal(native.webServer, undefined);
    const store = platformConfig("osx", {
        WRITEME_E2E_SUITE: "profiles",
        WRITEME_E2E_PROJECTS: '["macos-app-store"]',
    }).webServer;
    assert.ok(Array.isArray(store));
    assert.equal(store.length, 1);
    assert.match(store[0]!.command, /build:profile -- macos-app-store/);
    assert.doesNotMatch(store[0]!.command, /homebrew|ios-app-store|android-google-play/);
    assert.throws(
        () => platformConfig("osx", { WRITEME_E2E_SUITE: "profiles", WRITEME_E2E_PROJECTS: '["missing"]' }),
        /No .* projects match/,
    );
});

test("mobile restrictions reuse synced profile assets without another build", () => {
    const servers = platformConfig("ios", {
        WRITEME_E2E_SUITE: "profiles",
        WRITEME_E2E_PREBUILT: "1",
        WRITEME_E2E_PROFILE_DIR: "packages/mobile/dist",
    }).webServer;
    assert.ok(Array.isArray(servers));
    assert.equal(servers.length, 1);
    assert.match(servers[0]!.command, /--outDir packages\/mobile\/dist/);
    assert.doesNotMatch(servers[0]!.command, /build:profile|mobile:build|browser:build/);
    assert.equal(servers[0]!.env?.WRITEME_BUILD_PROFILE, "ios-app-store");
});

test("OSX keeps media tests on Chromium and offline handwriting on WebKit", () => {
    const config = platformConfig("osx", { WRITEME_E2E_SUITE: "production" });
    const chromium = config.projects!.find((project) => project.name === "chromium");
    const webkit = config.projects!.find((project) => project.name === "desktop-macos");
    assert.equal(chromium?.use?.browserName, "chromium");
    assert.ok(Array.isArray(chromium?.testMatch) && chromium.testMatch.includes("meeting-note.spec.ts"));
    assert.equal(webkit?.use?.browserName, "webkit");
    assert.ok(Array.isArray(webkit?.testMatch) && webkit.testMatch.includes("freehand-production.spec.ts"));
    assert.notEqual(webkit?.use?.serviceWorkers, "block");
});

test("physical-device execution fails explicitly when the external URL is missing", () => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.PLAYWRIGHT_DEVICE_BASE_URL;
    const result = spawnSync(
        process.execPath,
        ["--import", "tsx", runner, "--platform", "android", "--suite", "device"],
        { env, encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Set PLAYWRIGHT_DEVICE_BASE_URL/);
});
