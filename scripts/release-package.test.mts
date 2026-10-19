import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { releasePackages, type NpmRunner } from "./release-package.mts";

const packageVersions = { math: "1.0.0", cli: "2.4.6", mcp: "0.9.9" } as const;
const packages = ["math", "cli", "mcp"] as const;

type PackageName = (typeof packages)[number];

function fixture(): { repository: string; directories: Record<PackageName, string>; cleanup: () => void } {
    const repository = mkdtempSync(join(tmpdir(), "writeme-release-"));
    const directories = Object.fromEntries(
        packages.map((packageDirectory) => {
            const directory = join(repository, "packages", packageDirectory);
            mkdirSync(directory, { recursive: true });
            const name = `@writeme.dev/${packageDirectory}`;
            const version = packageVersions[packageDirectory];
            writeFileSync(
                join(directory, "package.json"),
                JSON.stringify({
                    name,
                    version,
                    private: false,
                    scripts: { validate: "node -e \\\"process.exit(0)\\\"", prepublishOnly: "npm run validate" },
                }),
            );
            writeFileSync(
                join(directory, "package-lock.json"),
                JSON.stringify({ name, version, lockfileVersion: 3, packages: { "": { name, version } } }),
            );
            return [packageDirectory, directory];
        }),
    ) as Record<PackageName, string>;
    writeFileSync(
        join(repository, "package.json"),
        JSON.stringify({ private: true, scripts: { release: "node --experimental-strip-types scripts/release-package.mts" } }),
    );
    const gitCommands = [
        ["init", "--initial-branch=main"],
        ["config", "user.name", "Release Test"],
        ["config", "user.email", "release@example.invalid"],
        ["add", "-A"],
        ["commit", "-m", "fixture"],
    ];
    for (const args of gitCommands) {
        const result = spawnSync("git", args, { cwd: repository, encoding: "utf8" });
        assert.ifError(result.error);
        assert.equal(result.status, 0, result.stdout + result.stderr);
    }
    return { repository, directories, cleanup: () => rmSync(repository, { recursive: true, force: true }) };
}

function updateManifest(directory: string, version: string): void {
    const manifestPath = join(directory, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, version }));
    const lockPath = join(directory, "package-lock.json");
    const lock = JSON.parse(readFileSync(lockPath, "utf8")) as {
        version: string;
        packages: { "": { version: string } };
    };
    writeFileSync(lockPath, JSON.stringify({ ...lock, version, packages: { "": { version } } }));
}

test("validates all packages before bumping and publishes each version in dependency order", () => {
    const project = fixture();
    try {
        const rootBefore = readFileSync(join(project.repository, "package.json"), "utf8");
        const calls: Array<{ args: string[]; directory: string }> = [];
        const run: NpmRunner = (args, directory) => {
            calls.push({ args, directory });
            if (args[0] === "version") {
                const packageDirectory = directory.split("/").at(-1) as PackageName;
                const nextVersion =
                    packageDirectory === "math"
                        ? "1.0.1"
                        : packageDirectory === "cli"
                          ? "2.4.7"
                          : "0.9.10";
                updateManifest(directory, nextVersion);
            }
            if (args[0] === "publish") {
                const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as {
                    version: string;
                };
                const packageDirectory = directory.split("/").at(-1) as PackageName;
                const expectedVersion =
                    packageDirectory === "math"
                        ? "1.0.1"
                        : packageDirectory === "cli"
                          ? "2.4.7"
                          : "0.9.10";
                assert.equal(manifest.version, expectedVersion);
                assert.deepEqual(args, [
                    "publish",
                    "--workspaces=false",
                    "--access",
                    "public",
                    "--ignore-scripts=false",
                    "--tag=latest",
                ]);
            }
        };

        releasePackages(["patch"], project.repository, run);

        assert.deepEqual(
            calls.map(({ args, directory }) => [args[0], directory.split("/").at(-1)]),
            [
                ["run", "math"],
                ["run", "cli"],
                ["run", "mcp"],
                ["version", "math"],
                ["version", "cli"],
                ["version", "mcp"],
                ["publish", "math"],
                ["publish", "cli"],
                ["publish", "mcp"],
            ],
        );
        assert.ok(calls.slice(0, 3).every(({ args }) => args[1] === "validate"));
        assert.ok(
            calls.slice(3, 6).every(
                ({ args }) =>
                    args[1] === "patch" &&
                    args.includes("--workspaces=false") &&
                    args.includes("--git-tag-version=false"),
            ),
        );
        assert.equal(readFileSync(join(project.repository, "package.json"), "utf8"), rootBefore);
        assert.equal(JSON.parse(readFileSync(join(project.directories.math, "package-lock.json"), "utf8")).version, "1.0.1");
        assert.equal(JSON.parse(readFileSync(join(project.directories.cli, "package.json"), "utf8")).version, "2.4.7");
        assert.equal(JSON.parse(readFileSync(join(project.directories.mcp, "package-lock.json"), "utf8")).version, "0.9.10");
    } finally {
        project.cleanup();
    }
});

test("validation failure blocks every version change and publication", () => {
    const project = fixture();
    try {
        const calls: string[][] = [];
        assert.throws(
            () =>
                releasePackages(["minor"], project.repository, (args) => {
                    calls.push(args);
                    if (args[0] === "run" && calls.length === 2) throw new Error("CLI validation failed");
                }),
            /CLI validation failed/,
        );
        assert.deepEqual(calls.map(([command]) => command), ["run", "run"]);
        for (const packageDirectory of packages) {
            assert.equal(
                JSON.parse(readFileSync(join(project.directories[packageDirectory], "package.json"), "utf8")).version,
                packageVersions[packageDirectory],
            );
        }
    } finally {
        project.cleanup();
    }
});

test("dry run validates all packages without versioning or publication", () => {
    const project = fixture();
    try {
        const calls: string[][] = [];
        releasePackages(["--", "major", "--dry-run"], project.repository, (args) => calls.push(args));
        assert.deepEqual(calls.map(([command]) => command), ["run", "run", "run"]);
        for (const packageDirectory of packages) {
            assert.equal(
                JSON.parse(readFileSync(join(project.directories[packageDirectory], "package.json"), "utf8")).version,
                packageVersions[packageDirectory],
            );
        }
    } finally {
        project.cleanup();
    }
});

test("refuses to publish from a non-main or dirty checkout", () => {
    const project = fixture();
    try {
        const run: NpmRunner = () => assert.fail("npm must not run");
        let result = spawnSync("git", ["switch", "-c", "release-test"], { cwd: project.repository, encoding: "utf8" });
        assert.ifError(result.error);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.throws(() => releasePackages(["patch"], project.repository, run), /main branch/);

        result = spawnSync("git", ["switch", "main"], { cwd: project.repository, encoding: "utf8" });
        assert.ifError(result.error);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        writeFileSync(join(project.repository, "uncommitted.txt"), "dirty");
        assert.throws(() => releasePackages(["patch"], project.repository, run), /Commit or stash/);
    } finally {
        project.cleanup();
    }
});

test("rejects unsupported version arguments and packages before invoking npm", () => {
    const project = fixture();
    try {
        const run: NpmRunner = () => assert.fail("npm must not run");
        for (const args of [[], ["math", "patch"], ["banana"], ["patch", "extra"], ["patch", "--tag=next"]]) {
            assert.throws(() => releasePackages(args, project.repository, run));
        }
        const manifestPath = join(project.directories.mcp, "package.json");
        writeFileSync(manifestPath, JSON.stringify({ ...JSON.parse(readFileSync(manifestPath, "utf8")), private: true }));
        assert.throws(() => releasePackages(["patch"], project.repository, run), /mcp must be public/);
    } finally {
        project.cleanup();
    }
});

test("reports partial publication and stops after the first registry failure", () => {
    const project = fixture();
    try {
        const calls: string[][] = [];
        assert.throws(
            () =>
                releasePackages(["patch"], project.repository, (args, directory) => {
                    calls.push(args);
                    if (args[0] === "version") {
                        const packageDirectory = directory.split("/").at(-1) as PackageName;
                        const nextVersion = packageDirectory === "math" ? "1.0.1" : packageDirectory === "cli" ? "2.4.7" : "0.9.10";
                        updateManifest(directory, nextVersion);
                    }
                    if (args[0] === "publish" && directory === project.directories.cli) {
                        throw new Error("registry unavailable");
                    }
                }),
            /Already published: @writeme\.dev\/math.*All package versions are bumped; retry publication for: @writeme\.dev\/cli.*@writeme\.dev\/mcp/,
        );
        assert.deepEqual(calls.filter(([command]) => command === "publish").map((args, index) => index), [0, 1]);
        assert.equal(JSON.parse(readFileSync(join(project.directories.math, "package.json"), "utf8")).version, "1.0.1");
        assert.equal(JSON.parse(readFileSync(join(project.directories.mcp, "package.json"), "utf8")).version, "0.9.10");
    } finally {
        project.cleanup();
    }
});

test("pnpm release patch invokes the batch release script", { skip: process.platform === "win32" }, () => {
    const project = fixture();
    try {
        const scripts = join(project.repository, "scripts");
        const binaries = join(project.repository, "bin");
        mkdirSync(scripts);
        mkdirSync(binaries);
        writeFileSync(
            join(scripts, "release-package.mts"),
            readFileSync(fileURLToPath(new URL("./release-package.mts", import.meta.url))),
        );
        writeFileSync(
            join(scripts, "release-version.mjs"),
            readFileSync(fileURLToPath(new URL("./release-version.mjs", import.meta.url))),
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
        const result = spawnSync("pnpm", ["release", "patch", "--dry-run"], {
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
        assert.equal(calls.length, packages.length);
        assert.ok(calls.every(({ args }) => args[0] === "run" && args[1] === "validate"));
        assert.ok(calls.every(({ cwd }) => packages.some((packageDirectory) => realpathSync(cwd) === realpathSync(project.directories[packageDirectory]))));
    } finally {
        project.cleanup();
    }
});
