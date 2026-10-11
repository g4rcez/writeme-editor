import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type PackedPackage = {
    name: string;
    filename: string;
    files: { path: string; mode: number }[];
};

export type PackedProject = {
    directory: string;
    packages: PackedPackage[];
    cleanup: () => void;
};

export const runtimes = [
    { name: "node", flags: [] },
    { name: "bun", flags: [] },
    { name: "deno", flags: ["run", "--node-modules-dir=manual", "-A"] },
] as const;

const packageDirectory = fileURLToPath(new URL("../", import.meta.url));
const packageName = (
    JSON.parse(readFileSync(join(packageDirectory, "package.json"), "utf8")) as { name: string }
).name;

export function runCommand(
    command: string,
    args: readonly string[],
    directory: string,
    env: NodeJS.ProcessEnv = process.env,
    input?: string,
): SpawnSyncReturns<string> {
    const result = spawnSync(command, args, {
        cwd: directory,
        env: { ...env, npm_config_dry_run: "false" },
        input,
        encoding: "utf8",
        timeout: 120_000,
    });
    assert.ifError(result.error);
    return result;
}

export function assertSuccess(result: SpawnSyncReturns<string>): void {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

export function installPackedPackages(names: readonly string[]): PackedProject {
    const directory = mkdtempSync(join(tmpdir(), "writeme-npm-"));
    const cleanup = (): void => rmSync(directory, { recursive: true, force: true });
    try {
        const npm = process.env.npm_execpath;
        assert.ok(npm, "Run package tests through npm run test:package.");
        const packages = names.map((name): PackedPackage => {
            const ownPackage = name === packageName;
            const source = ownPackage
                ? packageDirectory
                : dirname(dirname(fileURLToPath(import.meta.resolve(name))));
            const result = runCommand(
                process.execPath,
                [
                    npm,
                    "pack",
                    "--json",
                    "--pack-destination",
                    directory,
                    "--workspaces=false",
                    ...(ownPackage ? [] : ["--ignore-scripts"]),
                ],
                source,
            );
            assertSuccess(result);
            const [packed] = JSON.parse(result.stdout) as PackedPackage[];
            assert.ok(packed);
            assert.equal(packed.name, name);
            return packed;
        });
        writeFileSync(join(directory, "package.json"), JSON.stringify({ private: true, type: "module" }));
        const install = runCommand(
            process.execPath,
            [
                npm,
                "install",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
                "--omit=dev",
                "--package-lock=false",
                "--workspaces=false",
                "--prefer-offline",
                ...packages.map((packed) => join(directory, packed.filename)),
            ],
            directory,
        );
        assertSuccess(install);
        return { directory, packages, cleanup };
    } catch (error) {
        cleanup();
        throw error;
    }
}

export function assertPackageContents(project: PackedProject, name: string): void {
    const packed = project.packages.find((entry) => entry.name === name);
    assert.ok(packed);
    const paths = packed.files.map((file) => file.path);
    for (const required of ["package.json", "README.md", "LICENSE", "dist/index.js", "dist/index.d.ts"]) {
        assert.ok(paths.includes(required), `Missing ${required} in ${name}`);
    }
    for (const path of paths) {
        assert.match(path, /^(?:package\.json|README\.md|LICENSE|dist\/.+\.(?:js|d\.ts|js\.map))$/, path);
        assert.doesNotMatch(path, /(?:^|\/)(?:tests?|node_modules|src)(?:\/|\.)|\.test\./, path);
    }
    const installed = join(project.directory, "node_modules", name);
    const manifest = JSON.parse(readFileSync(join(installed, "package.json"), "utf8"));
    assert.equal(manifest.name, name);
    assert.equal(manifest.private, false);
    assert.equal(manifest.type, "module");
    assert.equal(manifest.publishConfig.access, "public");
}

export function typecheckConsumer(directory: string, file: string): void {
    const compiler = fileURLToPath(new URL("./tsc.js", import.meta.resolve("typescript")));
    const config = join(directory, "tsconfig.consumer.json");
    writeFileSync(
        config,
        JSON.stringify({
            compilerOptions: {
                noEmit: true,
                strict: true,
                skipLibCheck: false,
                module: "NodeNext",
                moduleResolution: "NodeNext",
                target: "ES2022",
                types: [],
            },
            files: [file],
        }),
    );
    assertSuccess(runCommand(process.execPath, [compiler, "--project", config], directory));
}
