import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import {
    existsSync,
    lstatSync,
    mkdirSync,
    readFileSync,
    realpathSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { join, resolve, toNamespacedPath } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
    assertSuccess,
    installPackedPackages,
    runtimes,
    runCommand,
    typecheckConsumer,
    type PackedProject,
} from "./npm-package.mts";

const packageName = "@writeme.dev/mcp";
const packageDirectory = fileURLToPath(new URL("../", import.meta.url));
const evidence = process.env.MCP_PACKAGE_EVIDENCE ?? join(packageDirectory, ".omo/evidence/mcp-package");
let project: PackedProject;
let installed: string;
let manifest: {
    name: string;
    version: string;
    private: boolean;
    type: string;
    bin: Record<string, string>;
    exports: Record<string, string | { types: string; import: string }>;
    dependencies?: Record<string, string>;
    publishConfig: { access: string };
};

const environment = (): NodeJS.ProcessEnv => ({ ...process.env, NODE_PATH: "", NODE_OPTIONS: "" });
function captured(
    command: string,
    args: readonly string[],
    name: string,
    env = environment(),
): ReturnType<typeof runCommand> {
    const result = runCommand(command, args, project.directory, env);
    writeFileSync(
        join(evidence, `${name}.log`),
        `${JSON.stringify({ command, args, cwd: project.directory, serverRuntime: env.MCP_RUNTIME, serverEntry: env.MCP_STDIO_ENTRY, serverCwd: env.MCP_STDIO_CWD, status: result.status })}\n${result.stdout}\n${result.stderr}`,
    );
    assertSuccess(result);
    return result;
}

before(() => {
    mkdirSync(evidence, { recursive: true });
    for (const runtime of runtimes) {
        const version = runCommand(runtime.name, ["--version"], packageDirectory);
        assertSuccess(version);
        writeFileSync(join(evidence, `${runtime.name}-version.log`), version.stdout + version.stderr);
    }
    // Normal npm pack executes prepack; installation uses only the resulting tarball.
    project = installPackedPackages([packageName]);
    project.directory = fileURLToPath(pathToFileURL(realpathSync.native(project.directory)));
    const nodeTypes = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
        .devDependencies["@types/node"] as string;
    captured(
        process.execPath,
        [
            process.env.npm_execpath!,
            "install",
            "--save-dev",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--package-lock=false",
            "--workspaces=false",
            "--prefer-offline",
            `@types/node@${nodeTypes}`,
        ],
        "consumer-node-types",
    );
    installed = join(project.directory, "node_modules", packageName);
    manifest = JSON.parse(readFileSync(join(installed, "package.json"), "utf8")) as typeof manifest;
    writeFileSync(join(evidence, "packed-files.json"), JSON.stringify(project.packages, null, 2));
    writeFileSync(join(evidence, "installed-package.json"), JSON.stringify(manifest, null, 2));
    writeFileSync(
        join(project.directory, "consumer.mjs"),
        `
import assert from 'node:assert/strict';
const before = process.listenerCount('SIGINT') + process.listenerCount('SIGTERM');
const api = await import('@writeme.dev/mcp');
assert.equal(api.CONTRACT_VERSION, '1.0');
assert.equal(typeof api.createWorkspaceReader, 'function');
assert.equal(typeof api.createServer, 'function');
assert.equal(api.toolNames.length, 16);
assert.equal(process.listenerCount('SIGINT') + process.listenerCount('SIGTERM'), before);
const resolved = import.meta.resolve('@writeme.dev/mcp');
assert.ok(resolved.includes('/node_modules/@writeme.dev/mcp/dist/public.js'));
console.log('public import passed');
`,
    );
    writeFileSync(
        join(project.directory, "consumer.ts"),
        `
/// <reference types="node" />
import { createServer, createWorkspaceReader, CONTRACT_VERSION, toolNames, type ReaderOptions, type WorkspaceReader } from '@writeme.dev/mcp';
const options: ReaderOptions = { profile: 'production', dataDir: '/unused-profile' };
const reader: WorkspaceReader = createWorkspaceReader(options);
const server = createServer(reader);
const version: '1.0' = CONTRACT_VERSION;
const names: readonly string[] = toolNames;
void [server, version, names];
`,
    );
});

after(() => project?.cleanup());

test("tarball has public metadata, executable Node bin, standalone exports and only distributable files", () => {
    const packed = project.packages.find((entry) => entry.name === packageName);
    assert.ok(packed);
    const paths = packed.files.map((entry) => entry.path);
    for (const required of [
        "package.json",
        "README.md",
        "CONTRACT.md",
        "LICENSE",
        "contract/v1.json",
        "dist/index.js",
        "dist/index.d.ts",
        "dist/public.js",
        "dist/public.d.ts",
    ])
        assert.ok(paths.includes(required), `Missing ${required}`);
    for (const name of paths) {
        assert.match(
            name,
            /^(?:package\.json|README\.md|CONTRACT\.md|LICENSE|contract\/v1\.json|dist\/.+\.(?:js|d\.ts|js\.map|d\.ts\.map))$/,
            name,
        );
        assert.doesNotMatch(name, /(?:^|\/)(?:tests?|package-tests|node_modules|src)(?:\/|\.)|\.test\./);
    }
    assert.equal(manifest.name, packageName);
    assert.equal(manifest.private, false);
    assert.equal(manifest.type, "module");
    assert.equal(manifest.publishConfig.access, "public");
    assert.equal(lstatSync(installed).isSymbolicLink(), false);
    assert.ok(realpathSync(installed).startsWith(realpathSync(project.directory)));
    for (const dependency of Object.values(manifest.dependencies ?? {}))
        assert.doesNotMatch(dependency, /^(?:workspace:|file:|link:)/);
    assert.equal(manifest.bin["writeme-mcp"], "./dist/index.js");
    const publicEntry = manifest.exports["."];
    assert.ok(publicEntry && typeof publicEntry === "object");
    assert.equal(publicEntry.import, "./dist/public.js");
    assert.equal(publicEntry.types, "./dist/public.d.ts");
    assert.equal(manifest.exports["./cli"], "./dist/index.js");
    for (const entry of Object.values(manifest.exports)) {
        if (typeof entry === "string") assert.ok(readFileSync(join(installed, entry)).length > 0);
        else {
            assert.ok(readFileSync(join(installed, entry.import)).length > 0);
            assert.ok(readFileSync(join(installed, entry.types)).length > 0);
        }
    }
    const bin = join(installed, "dist/index.js");
    assert.ok(readFileSync(bin, "utf8").startsWith("#!/usr/bin/env node\n"));
    const shim = join(
        project.directory,
        "node_modules/.bin",
        process.platform === "win32" ? "writeme-mcp.cmd" : "writeme-mcp",
    );
    assert.ok(existsSync(shim));
    if (process.platform !== "win32") {
        assert.ok(statSync(bin).mode & 0o111, "Installed executable must retain executable mode");
        const result = captured(shim, ["--version"], "installed-bin");
        assert.equal(result.stdout.trim(), manifest.version);
    }
});

test("published declarations typecheck in an isolated strict TypeScript consumer", () => {
    typecheckConsumer(project.directory, "consumer.ts");
    writeFileSync(
        join(evidence, "declarations.log"),
        "Strict isolated TypeScript consumer with explicit @types/node passed with skipLibCheck=false and no repository aliases.\n",
    );
});

for (const runtime of runtimes) {
    test(`${runtime.name}: installed CLI help/version and side-effect-free public exports`, () => {
        const entry = runtime.name === "deno" ? "npm:@writeme.dev/mcp/cli" : join(installed, "dist/index.js");
        const help = captured(runtime.name, [...runtime.flags, entry, "--help"], `${runtime.name}-help`);
        assert.match(help.stdout, /Writeme MCP/);
        assert.match(help.stdout, /--data-dir/);
        const version = captured(
            runtime.name,
            [...runtime.flags, entry, "--version"],
            `${runtime.name}-cli-version`,
        );
        assert.equal(version.stdout.trim(), manifest.version);
        const imported = captured(runtime.name, [...runtime.flags, "consumer.mjs"], `${runtime.name}-public`);
        assert.equal(imported.stdout.trim(), "public import passed");
    });
    test(`${runtime.name}: installed tarball passes all 16 tool contracts with SQLite and filesystem fixtures`, () => {
        const result = captured(
            "bun",
            ["test", resolve(packageDirectory, "tests/contract.test.ts")],
            `${runtime.name}-contract`,
            {
                ...environment(),
                MCP_RUNTIME: runtime.name,
                MCP_STDIO_ENTRY: join(installed, "dist/index.js"),
                MCP_STDIO_CWD: project.directory,
            },
        );
        assert.match(result.stdout + result.stderr, /4 pass/);
        assert.match(result.stdout + result.stderr, /0 fail/);
    });
}

test("deno: installed npm CLI reads saved files with scoped filesystem permissions and no network/ffi/run grants", async () => {
    const packageRoot = project.directory;
    const profile = join(packageRoot, "scoped-profile");
    const workspace = join(packageRoot, "scoped-workspace");
    const scratch = join(packageRoot, "snapshot-temp");
    for (const directory of [profile, workspace, scratch]) mkdirSync(directory);
    const notePath = join(workspace, "saved.md");
    writeFileSync(notePath, "Saved scoped-permission note.");
    const database = new DatabaseSync(join(profile, "writeme.sqlite"));
    database.exec(
        "CREATE TABLE notes(id TEXT, title TEXT, content TEXT, filePath TEXT, noteType TEXT); CREATE TABLE settings(name TEXT, value TEXT);",
    );
    database
        .prepare("INSERT INTO notes VALUES(?,?,?,?,?)")
        .run("scoped-note", "Scoped note", "stale sqlite content", notePath, "note");
    for (const name of ["directory", "templatesDirectory", "quicknotesDirectory"])
        database.prepare("INSERT INTO settings VALUES(?,?)").run(name, JSON.stringify(workspace));
    database.close();
    const args = [
        "run",
        "--no-prompt",
        "--node-modules-dir=manual",
        `--allow-read=${[...new Set([packageRoot, toNamespacedPath(packageRoot)])].join(",")}`,
        `--allow-write=${[...new Set([scratch, toNamespacedPath(scratch)])].join(",")}`,
        "--allow-env",
        "--allow-sys",
        "npm:@writeme.dev/mcp/cli",
        "--data-dir",
        profile,
        "--workspace",
        workspace,
    ];
    const client = new Client({ name: "scoped-deno-package-test", version: "1.0.0" });
    const env = {
        ...Object.fromEntries(
            Object.entries(environment()).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
        ),
        TMPDIR: scratch,
        TMP: scratch,
        TEMP: scratch,
    };
    try {
        await client.connect(
            new StdioClientTransport({
                command: "deno",
                args,
                cwd: project.directory,
                env,
            }),
        );
        const response = await client.callTool({
            name: "get_note",
            arguments: { ref: "scoped-note", format: "content", raw: true },
        });
        let diagnostic = "";
        if (response.isError) {
            const entry = join(packageRoot, "scoped-reader.mjs");
            writeFileSync(
                entry,
                `import { createWorkspaceReader } from '@writeme.dev/mcp';\nawait createWorkspaceReader(${JSON.stringify({ profile: "production", dataDir: profile, workspace })}).snapshot();\n`,
            );
            const result = runCommand("deno", [...args.slice(0, 7), entry], packageRoot, env);
            diagnostic = result.stdout + result.stderr;
        }
        assert.equal(response.isError ?? false, false, JSON.stringify(response) + diagnostic);
        assert.deepEqual(
            (response.structuredContent as { content: { text: string } }).content.text,
            "Saved scoped-permission note.",
        );
        writeFileSync(
            join(evidence, "deno-scoped.json"),
            JSON.stringify({ args, result: response.structuredContent }, null, 2),
        );
    } finally {
        await client.close();
    }
});
