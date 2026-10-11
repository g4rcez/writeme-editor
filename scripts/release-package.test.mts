import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { releasePackage, type NpmRunner } from "./release-package.mts";

function fixture(): { repository: string; directory: string; cleanup: () => void } {
    const repository = mkdtempSync(join(tmpdir(), "writeme-release-"));
    const directory = join(repository, "packages", "math");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(repository, "package.json"), JSON.stringify({ private: true, workspaces: ["packages/*"] }));
    writeFileSync(
        join(directory, "package.json"),
        JSON.stringify({
            name: "@writeme.dev/math",
            version: "1.0.0",
            private: false,
            scripts: { validate: 'node -e "process.exit(0)"', prepublishOnly: "npm run validate" },
        }),
    );
    writeFileSync(
        join(directory, "package-lock.json"),
        JSON.stringify({
            name: "@writeme.dev/math",
            version: "1.0.0",
            lockfileVersion: 3,
            packages: { "": { name: "@writeme.dev/math", version: "1.0.0" } },
        }),
    );
    return { repository, directory, cleanup: () => rmSync(repository, { recursive: true, force: true }) };
}

for (const [version, options, expected] of [
    ["patch", [], "1.0.1"],
    ["minor", [], "1.1.0"],
    ["major", [], "2.0.0"],
    ["premajor", ["--preid", "beta"], "2.0.0-beta.0"],
    ["preminor", [], "1.1.0-0"],
    ["prepatch", [], "1.0.1-0"],
    ["prerelease", ["--preid=rc", "--tag=beta"], "1.0.1-rc.0"],
    ["2.3.4", [], "2.3.4"],
    ["1.0.0", ["--allow-same-version"], "1.0.0"],
] as const) {
    test(`${version}: real npm version updates only the selected manifest and lockfile before publication`, () => {
        const project = fixture();
        try {
            const rootBefore = readFileSync(join(project.repository, "package.json"), "utf8");
            const calls: string[][] = [];
            const run: NpmRunner = (args, directory) => {
                assert.equal(directory, project.directory);
                calls.push(args);
                if (args[0] === "publish") {
                    assert.equal(JSON.parse(readFileSync(join(directory, "package.json"), "utf8")).version, expected);
                    assert.ok(
                        args.includes(
                            `--tag=${options.some((option) => option === "--tag=beta") ? "beta" : expected.includes("-") ? "next" : "latest"}`,
                        ),
                    );
                    return;
                }
                const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
                    cwd: directory,
                    encoding: "utf8",
                });
                assert.ifError(result.error);
                assert.equal(result.status, 0, result.stdout + result.stderr);
            };
            releasePackage(["math", version, ...options], project.repository, run);
            assert.deepEqual(
                calls.map((args) => args[0]),
                ["run", "version", "publish"],
            );
            assert.equal(
                JSON.parse(readFileSync(join(project.directory, "package-lock.json"), "utf8")).packages[""].version,
                expected,
            );
            assert.equal(readFileSync(join(project.repository, "package.json"), "utf8"), rootBefore);
        } finally {
            project.cleanup();
        }
    });
}

test("validation failure prevents both version changes and publication", () => {
    const project = fixture();
    try {
        const before = readFileSync(join(project.directory, "package.json"), "utf8");
        const calls: string[][] = [];
        assert.throws(
            () =>
                releasePackage(["math", "patch"], project.repository, (args) => {
                    calls.push(args);
                    throw new Error("validation failed");
                }),
            /validation failed/,
        );
        assert.equal(calls.length, 1);
        assert.equal(calls[0]?.[0], "run");
        assert.equal(readFileSync(join(project.directory, "package.json"), "utf8"), before);
    } finally {
        project.cleanup();
    }
});

test("dry run validates without changing versions or publishing, including npm's argument separator", () => {
    const project = fixture();
    try {
        const calls: string[][] = [];
        releasePackage(["--", "math", "minor", "--dry-run"], project.repository, (args) => {
            calls.push(args);
        });
        assert.deepEqual(
            calls.map((args) => args[0]),
            ["run"],
        );
        assert.equal(JSON.parse(readFileSync(join(project.directory, "package.json"), "utf8")).version, "1.0.0");
    } finally {
        project.cleanup();
    }
});

test("invalid arguments and private or unvalidated packages fail before invoking npm", () => {
    const project = fixture();
    try {
        const run: NpmRunner = () => assert.fail("npm must not run");
        for (const args of [
            [],
            ["math"],
            ["math", "patch", "extra"],
            ["../math", "patch"],
            ["missing", "patch"],
            ["math", "banana"],
            ["math", "patch", "--ignore-scripts"],
        ]) {
            assert.throws(() => releasePackage(args, project.repository, run));
        }
        writeFileSync(join(project.directory, "package.json"), JSON.stringify({ private: true }));
        assert.throws(() => releasePackage(["math", "patch"], project.repository, run), /must be public/);
        writeFileSync(
            join(project.directory, "package.json"),
            JSON.stringify({ private: false, scripts: { validate: "echo ok" } }),
        );
        assert.throws(() => releasePackage(["math", "patch"], project.repository, run), /prepublishOnly/);
    } finally {
        project.cleanup();
    }
});

test("npm version failure stops publication; publish failures retain the bumped version and explain retry", () => {
    const project = fixture();
    try {
        const calls: string[][] = [];
        assert.throws(
            () =>
                releasePackage(["math", "from-git"], project.repository, (args) => {
                    calls.push(args);
                    if (args[0] === "version") throw new Error("no git tag");
                }),
            /no git tag/,
        );
        assert.deepEqual(
            calls.map((args) => args[0]),
            ["run", "version"],
        );
        assert.throws(
            () =>
                releasePackage(["math", "patch"], project.repository, (args, directory) => {
                    if (args[0] === "version") {
                        const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
                        writeFileSync(
                            join(directory, "package.json"),
                            JSON.stringify({ ...manifest, version: "1.0.1" }),
                        );
                    }
                    if (args[0] === "publish") throw new Error("registry failure");
                }),
            /remains at 1.0.1.*Retry npm publish/,
        );
    } finally {
        project.cleanup();
    }
});

for (const [selected, version] of [
    ["cli", "minor"],
    ["math", "patch"],
    ["mcp", "minor"],
]) {
    test(
        `pnpm release ${selected} ${version}: launcher calls npm validation, versioning, and publication`,
        { skip: process.platform === "win32" },
        () => {
            const project = fixture();
            try {
                const directory = join(project.repository, "packages", selected!);
                mkdirSync(directory, { recursive: true });
                writeFileSync(join(directory, "package.json"), readFileSync(join(project.directory, "package.json")));
                const scripts = join(project.repository, "scripts");
                const binaries = join(project.repository, "bin");
                mkdirSync(scripts);
                mkdirSync(binaries);
                writeFileSync(
                    join(scripts, "release-package.mts"),
                    readFileSync(fileURLToPath(new URL("./release-package.mts", import.meta.url))),
                );
                writeFileSync(
                    join(project.repository, "package.json"),
                    JSON.stringify({
                        private: true,
                        scripts: { release: "node --experimental-strip-types scripts/release-package.mts" },
                    }),
                );
                const log = join(project.repository, "npm-calls.jsonl");
                const mock = join(binaries, "npm");
                writeFileSync(
                    mock,
                    `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }) + "\\n");
`,
                );
                chmodSync(mock, 0o755);
                const result = spawnSync("pnpm", ["release", selected!, version!], {
                    cwd: project.repository,
                    env: { ...process.env, PATH: `${binaries}:${process.env.PATH}` },
                    encoding: "utf8",
                    timeout: 30_000,
                });
                assert.ifError(result.error);
                assert.equal(result.status, 0, result.stdout + result.stderr);
                const calls = readFileSync(log, "utf8")
                    .trim()
                    .split("\n")
                    .map((line) => JSON.parse(line) as { args: string[]; cwd: string });
                assert.deepEqual(
                    calls.map((call) => call.args[0]),
                    ["run", "version", "publish"],
                );
                assert.equal(calls[1]?.args[1], version);
                assert.ok(calls.every((call) => realpathSync(call.cwd) === realpathSync(directory)));
            } finally {
                project.cleanup();
            }
        },
    );
}
