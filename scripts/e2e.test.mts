import type { JSONReport, JSONReportSuite } from "@playwright/test/reporter";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseE2EArguments, type Platform, type Suite } from "./e2e-options.mts";

const root = fileURLToPath(new URL("../", import.meta.url));
const runner = fileURLToPath(new URL("./e2e.mts", import.meta.url));
type ListedTest = { id: string; file: string; title: string; project: string; tags: string[] };

function run(args: string[], overrides: NodeJS.ProcessEnv = {}): ReturnType<typeof spawnSync> {
    const env: NodeJS.ProcessEnv = { ...process.env, WRITEME_E2E_PREBUILT: "1" };
    for (const name of [
        "WRITEME_E2E_PROJECTS",
        "WRITEME_E2E_LIVE_WHISPER",
        "RECORD_COMPLETION_DEMO",
        "MEETING_WHISPER_ENDPOINT",
        "MEETING_AUDIO_FIXTURE",
        "PLAYWRIGHT_DEVICE_BASE_URL",
        "PLAYWRIGHT_JSON_OUTPUT_FILE",
        "PLAYWRIGHT_JSON_OUTPUT_DIR",
        "PLAYWRIGHT_JSON_OUTPUT_NAME",
    ])
        delete env[name];
    return spawnSync(process.execPath, ["--import", "tsx", runner, ...args], {
        cwd: root,
        env: { ...env, ...overrides },
        encoding: "utf8",
        timeout: 60_000,
        maxBuffer: 10 * 1024 * 1024,
    });
}

function list(platform: Platform, suite: Suite, args: string[] = [], env: NodeJS.ProcessEnv = {}): ListedTest[] {
    const result = run(["--platform", platform, "--suite", suite, ...args, "--list", "--reporter=json"], env);
    assert.equal(result.status, 0, `${result.error ?? ""}\n${result.stderr}\n${result.stdout}`);
    const report: JSONReport = JSON.parse(String(result.stdout));
    assert.deepEqual(report.errors, []);
    const tests: ListedTest[] = [];
    const visit = (suites: JSONReportSuite[]): void => {
        for (const suite of suites) {
            for (const spec of suite.specs) {
                for (const test of spec.tests)
                    tests.push({
                        id: spec.id,
                        file: path.basename(spec.file),
                        title: spec.title,
                        project: test.projectName,
                        tags: spec.tags.map((tag) => (tag.startsWith("@") ? tag : `@${tag}`)),
                    });
            }
            visit(suite.suites ?? []);
        }
    };
    visit(report.suites);
    return tests;
}

function files(tests: ListedTest[], project?: string): string[] {
    return [...new Set(tests.filter((test) => !project || test.project === project).map((test) => test.file))].sort();
}

test("forwards positional selectors and arbitrary Playwright options", () => {
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
            "--shard=2/3",
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
                "--shard=2/3",
            ],
        },
    );
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

test("desktop manifests discover new browser and production specs without editing a selection list", async () => {
    const directory = await mkdtemp(path.join(root, "tests/e2e/runner-discovery-"));
    const spec = (title: string, tag?: string[]): string =>
        `import { test } from '@playwright/test';\ntest(${JSON.stringify(title)}, ${JSON.stringify({ tag })}, async () => {});\n`;
    try {
        await writeFile(path.join(directory, "new-browser.spec.ts"), spec("new browser regression"));
        await writeFile(path.join(directory, "new-production.spec.ts"), spec("new filename production regression"));
        await writeFile(
            path.join(directory, "new-tagged.spec.ts"),
            spec("new tagged production regression", ["@production", "@production-only"]),
        );
        await writeFile(
            path.join(directory, "new-shared.spec.ts"),
            spec("new shared production regression", ["@production"]),
        );
        const excluded = new Set([
            "editor-completion-video.spec.ts",
            "freehand-lifecycle.spec.ts",
            "freehand-pens.spec.ts",
            "freehand-pen-dots.spec.ts",
            "meeting-note.spec.ts",
        ]);
        const browserFiles = (await readdir(path.join(root, "tests/e2e"))).filter(
            (file) => file.endsWith(".spec.ts") && !file.endsWith("-production.spec.ts") && !excluded.has(file),
        );
        for (const platform of ["windows", "linux", "osx"] as const) {
            const browser = list(platform, "browser");
            assert.deepEqual(
                files(browser, "chromium"),
                [...browserFiles, "new-browser.spec.ts", "new-shared.spec.ts"].sort(),
            );
            assert.ok(browser.every((test) => !test.tags.includes("@production-only")));
            const production = list(platform, "production");
            for (const file of [
                "new-production.spec.ts",
                "new-tagged.spec.ts",
                "new-shared.spec.ts",
                "meeting-note.spec.ts",
                "vim-settings.spec.ts",
                "note-comments-production.spec.ts",
            ])
                assert.ok(files(production, "chromium").includes(file), `${platform} production omits ${file}`);
            assert.ok(!files(production).includes("new-browser.spec.ts"));
            assert.ok(!files(production).includes("editor-completion-video.spec.ts"));
            assert.ok(production.every((test) => !test.tags.includes("@live-local-whisper")));
            const handwriting = [
                "freehand-production.spec.ts",
                "freehand-lifecycle.spec.ts",
                "freehand-pens.spec.ts",
                "freehand-pen-dots.spec.ts",
            ].sort();
            assert.deepEqual(
                files(production).filter((file) => file.startsWith("freehand-")),
                handwriting,
            );
            if (platform === "osx") {
                assert.deepEqual(files(browser, "desktop-macos"), ["freehand-note.spec.ts"]);
                assert.ok(
                    browser
                        .filter((test) => test.project === "desktop-macos")
                        .every((test) => !test.tags.includes("@chromium-input")),
                );
                assert.deepEqual(files(production, "desktop-macos"), handwriting);
                assert.ok(files(production, "chromium").every((file) => !file.startsWith("freehand-")));
                assert.ok(
                    production
                        .filter((test) => test.project === "desktop-macos")
                        .every((test) => !test.tags.includes("@chromium-input")),
                );
            }
        }
        const grep = list("linux", "production", ["--grep=regression"]);
        assert.deepEqual(files(grep), ["new-production.spec.ts", "new-shared.spec.ts", "new-tagged.spec.ts"]);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test("native discovery includes every portable spec and only macOS discovers application-menu", async () => {
    const directory = await mkdtemp(path.join(root, "tests/native/runner-discovery-"));
    try {
        await writeFile(
            path.join(directory, "new-native.spec.ts"),
            "import { test } from '@playwright/test';\ntest('new native regression', async () => {});\n",
        );
        const all = (await readdir(path.join(root, "tests/native"))).filter(
            (file) => file.endsWith(".spec.ts") && file !== "build-profiles.spec.ts",
        );
        for (const platform of ["windows", "linux", "osx"] as const) {
            const expected = all.filter((file) => platform === "osx" || file !== "application-menu.spec.ts");
            assert.deepEqual(files(list(platform, "native")), [...expected, "new-native.spec.ts"].sort());
        }
        assert.deepEqual(files(list("osx", "profiles", ["--project", "native-store"])), ["build-profiles.spec.ts"]);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test("mobile manifests retain phone/tablet handwriting and separate root production drawing", () => {
    for (const platform of ["ios", "android"] as const) {
        const phone = `${platform}-phone`;
        const tablet = platform === "ios" ? "ipad" : "android-tablet";
        const browser = list(platform, "browser", ["--project", phone, tablet]);
        assert.deepEqual([...new Set(browser.map((test) => test.project))].sort(), [phone, tablet].sort());
        assert.deepEqual(files(browser), ["freehand-note.spec.ts"]);
        if (platform === "ios") assert.ok(browser.every((test) => !test.tags.includes("@chromium-input")));
        else assert.ok(browser.some((test) => test.tags.includes("@chromium-input")));
        const production = list(platform, "production");
        const handwriting = [
            "freehand-lifecycle.spec.ts",
            "freehand-pen-dots.spec.ts",
            "freehand-pens.spec.ts",
            "freehand-production.spec.ts",
        ];
        assert.deepEqual(files(production, phone), handwriting);
        assert.deepEqual(files(production, tablet), handwriting);
        assert.deepEqual(files(production, `${platform}-web-drawing`), ["excalidraw.spec.ts"]);
        if (platform === "ios") assert.ok(production.every((test) => !test.tags.includes("@chromium-input")));
        else assert.ok(production.some((test) => test.tags.includes("@chromium-input")));
    }
    assert.deepEqual(files(list("ios", "production", ["--project", "ios-web-drawing", "--grep", ".*"])), [
        "excalidraw.spec.ts",
    ]);
});

test("completion video is operator-only discovery rather than a skipped regression", () => {
    const demo = list("linux", "browser", ["tests/e2e/editor-completion-video.spec.ts"], {
        RECORD_COMPLETION_DEMO: "1",
    });
    assert.deepEqual(files(demo), ["editor-completion-video.spec.ts"]);
    assert.ok(demo.length > 0);
});

test("twelve parallel browser shards cover every discovered scenario exactly once", () => {
    const complete = list("linux", "browser");
    const shards = Array.from({ length: 12 }, (_, index) =>
        list("linux", "browser", [`--shard=${index + 1}/12`, "--workers=2"]),
    );
    const keys = (tests: ListedTest[]): string[] => tests.map((test) => `${test.project}:${test.id}`).sort();
    assert.deepEqual(keys(shards.flat()), keys(complete));
});

test("live Whisper is explicitly selectable by tag or existing grep without requiring resources for enumeration", () => {
    for (const grep of ["@live-local-whisper", "live local Whisper"]) {
        const manifest = list("linux", "production", ["--project", "chromium", "--grep", grep]);
        assert.equal(manifest.length, 1);
        assert.equal(manifest[0]!.file, "meeting-note.spec.ts");
        assert.ok(manifest[0]!.tags.includes("@live-local-whisper"));
        const result = run(["--platform", "linux", "--suite", "production", "--grep", grep]);
        assert.notEqual(result.status, 0);
        assert.match(String(result.stderr), /Live Whisper requires MEETING_WHISPER_ENDPOINT and MEETING_AUDIO_FIXTURE/);
    }
});

test("physical device execution fails explicitly when the external URL is missing", () => {
    const result = run(["--platform", "android", "--suite", "device"]);
    assert.notEqual(result.status, 0);
    assert.match(String(result.stderr), /Set PLAYWRIGHT_DEVICE_BASE_URL/);
});

test("native store execution rejects non-macOS hosts before using prebuilt artifacts", () => {
    const result = spawnSync(
        process.execPath,
        [
            "--import",
            "tsx",
            "--import",
            "data:text/javascript,Object.defineProperty(process,'platform',{value:'linux'})",
            runner,
            "--platform",
            "osx",
            "--suite",
            "profiles",
            "--project",
            "native-store",
        ],
        { env: { ...process.env, WRITEME_E2E_PREBUILT: "1" }, encoding: "utf8", timeout: 10_000 },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Run native Electron tests on the requested desktop OS/);
});
