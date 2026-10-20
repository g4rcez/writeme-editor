import type { SpawnSyncReturns } from "node:child_process";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import {
    assertPackageContents,
    assertSuccess,
    installPackedPackages,
    runtimes,
    runCommand,
    type PackedProject,
} from "./npm-package.mts";

let project: PackedProject;
let env: NodeJS.ProcessEnv;
let databaseFile: string;
let originalDatabase: Buffer;

function getDatabaseFile(home: string): string {
    const directory =
        process.platform === "darwin"
            ? join(home, "Library", "Application Support", "writeme")
            : process.platform === "win32"
              ? join(home, "AppData", "Roaming", "writeme")
              : join(home, ".config", "writeme");
    return join(directory, "writeme.sqlite");
}

before(() => {
    project = installPackedPackages(["@writeme.dev/math", "@writeme.dev/cli"]);
    const home = join(project.directory, "home");
    const appData = join(home, "AppData", "Roaming");
    env = { ...process.env, HOME: home, USERPROFILE: home, APPDATA: appData };
    databaseFile = getDatabaseFile(home);
    mkdirSync(join(databaseFile, ".."), { recursive: true });
    const db = new DatabaseSync(databaseFile);
    try {
        db.exec(`
            CREATE TABLE notes (
                id TEXT PRIMARY KEY, title TEXT, content TEXT, noteType TEXT, filePath TEXT,
                tags TEXT, project TEXT, createdAt INTEGER, updatedAt INTEGER,
                favorite INTEGER, url TEXT, description TEXT
            );
            CREATE TABLE hashtags (hashtag TEXT, filename TEXT);
            CREATE TABLE settings (name TEXT, value TEXT);
            CREATE TABLE projects (id TEXT, title TEXT, folderPath TEXT);
            INSERT INTO notes VALUES ('n1', 'Older note', 'hello', 'note', '/a.md', '[]', NULL, 1, 1, 0, NULL, NULL);
            INSERT INTO notes VALUES ('n2', 'Quick note', 'quick', 'quick', '/b.md', '[]', NULL, 1, 2, 1, NULL, NULL);
            INSERT INTO hashtags VALUES ('work', '/a.md'), ('work', '/a.md'), ('personal', '/b.md');
            INSERT INTO settings VALUES ('theme', 'dark'), ('font', 'Libron');
            INSERT INTO projects VALUES ('p2', 'Zebra', '/z'), ('p1', 'Alpha', '/a');
        `);
    } finally {
        db.close();
    }
    originalDatabase = readFileSync(databaseFile);
});

after(() => project?.cleanup());

test("CLI tarball installs writeme and math-cli executables and excludes standalone binaries and source tests", () => {
    assertPackageContents(project, "@writeme.dev/cli");
    const packageDirectory = join(project.directory, "node_modules", "@writeme.dev", "cli");
    const manifest = JSON.parse(readFileSync(join(packageDirectory, "package.json"), "utf8"));
    assert.deepEqual(manifest.bin, {
        writeme: "./dist/index.js",
        "math-cli": "./dist/math-cli.js",
    });

    const entryPath = join(packageDirectory, "dist", "index.js");
    const mathEntryPath = join(packageDirectory, "dist", "math-cli.js");
    assert.ok(readFileSync(entryPath, "utf8").startsWith("#!/usr/bin/env node\n"));
    assert.ok(readFileSync(mathEntryPath, "utf8").startsWith("#!/usr/bin/env node\n"));
    const binDirectory = join(project.directory, "node_modules", ".bin");
    const writemeExecutable = join(binDirectory, process.platform === "win32" ? "writeme.cmd" : "writeme");
    const mathExecutable = join(binDirectory, process.platform === "win32" ? "math-cli.cmd" : "math-cli");
    assert.ok(existsSync(writemeExecutable));
    assert.ok(existsSync(mathExecutable));

    if (process.platform !== "win32") {
        assert.ok(statSync(entryPath).mode & 0o111, "Writeme CLI entry must be executable");
        assert.ok(statSync(mathEntryPath).mode & 0o111, "Math CLI entry must be executable");
    }

    const writemeResult =
        process.platform === "win32"
            ? runCommand(process.execPath, [entryPath, "expr", "1 + 1"], project.directory, env)
            : runCommand(writemeExecutable, ["expr", "1 + 1"], project.directory, env);
    assertSuccess(writemeResult);
    assert.equal(writemeResult.stdout.trim(), "2");

    const mathResult =
        process.platform === "win32"
            ? runCommand(process.execPath, [mathEntryPath], project.directory, env, "1 + 1\n.exit\n")
            : runCommand(mathExecutable, [], project.directory, env, "1 + 1\n.exit\n");
    assertSuccess(mathResult);
    assert.match(mathResult.stdout, /2/);
});

for (const runtime of runtimes) {
    const runCli = (args: string[], environment = env, input?: string): SpawnSyncReturns<string> => {
        const entry =
            runtime.name === "deno"
                ? "npm:@writeme.dev/cli"
                : join("node_modules", "@writeme.dev", "cli", "dist", "index.js");
        return runCommand(runtime.name, [...runtime.flags, entry, ...args], project.directory, environment, input);
    };

    test(`${runtime.name}: math REPL keeps session variables and persists history under the temporary home`, () => {
        const input = "price: 10\nquantity: 20\nsum\n.exit\n";
        const result = runCli(["math"], env, input);
        assertSuccess(result);
        assert.match(result.stdout, /price: 10/);
        assert.match(result.stdout, /quantity: 20/);
        assert.match(result.stdout, /sum: 30/);
        const history = join(env.HOME!, ".config", "writeme", "math-repl");
        assert.ok(readFileSync(history, "utf8").endsWith("price: 10\nquantity: 20\nsum\n"));
        assert.equal(readFileSync(history, "utf8").includes(".exit"), false);
    });

    test(`${runtime.name}: installed CLI evaluates math and reports expression failures`, () => {
        for (const [expression, expected] of [
            ["1 + 1", "2"],
            ["rule3(2/4, x/10)", "5"],
            ["epoch 0", "1970-01-01 00:00:00 UTC"],
        ]) {
            const result = runCli(["expr", expression!]);
            assertSuccess(result);
            assert.equal(result.stdout.trim(), expected);
        }
        const invalid = runCli(["expr", "totally bogus &&&"]);
        assert.equal(invalid.status, 1);
        assert.equal(invalid.stdout, "");
        assert.ok(invalid.stderr.trim());
        const empty = runCli(["expr"]);
        assert.equal(empty.status, 1);
        assert.match(empty.stdout, /Usage: writeme expr/);
    });

    test(`${runtime.name}: note queries combine filters, deduplicate tags, and respect ordering and limits`, () => {
        const all = runCli(["query", "notes", "--json", "--limit", "1"]);
        assertSuccess(all);
        assert.deepEqual(
            JSON.parse(all.stdout).map((note: { id: string }) => note.id),
            ["n2"],
        );
        const filtered = runCli(["query", "notes", "--json", "--tag", "work", "--type", "note", "--search", "hello"]);
        assertSuccess(filtered);
        assert.deepEqual(
            JSON.parse(filtered.stdout).map((note: { id: string }) => note.id),
            ["n1"],
        );
        const injection = runCli(["query", "notes", "--json", "--search", "' OR 1=1 --"]);
        assertSuccess(injection);
        assert.deepEqual(JSON.parse(injection.stdout), []);
        const empty = runCli(["query", "notes", "--search", "no matching note"]);
        assertSuccess(empty);
        assert.equal(empty.stdout.trim(), "No results.");
        assert.deepEqual(readFileSync(databaseFile), originalDatabase);
    });

    test(`${runtime.name}: tags, settings, and projects return sorted JSON from the existing database`, () => {
        const tags = runCli(["query", "tags", "--json", "--note", "n2"]);
        assertSuccess(tags);
        assert.deepEqual(JSON.parse(tags.stdout), [{ hashtag: "personal", filename: "/b.md" }]);
        const missing = runCli(["query", "tags", "--json", "--note", "missing"]);
        assertSuccess(missing);
        assert.deepEqual(JSON.parse(missing.stdout), []);
        const settings = runCli(["query", "settings", "--json"]);
        assertSuccess(settings);
        assert.deepEqual(
            JSON.parse(settings.stdout).map((row: { name: string }) => row.name),
            ["font", "theme"],
        );
        const projects = runCli(["query", "projects", "--json"]);
        assertSuccess(projects);
        assert.deepEqual(
            JSON.parse(projects.stdout).map((row: { id: string }) => row.id),
            ["p1", "p2"],
        );
        assert.deepEqual(readFileSync(databaseFile), originalDatabase);
    });

    test(`${runtime.name}: invalid query arguments fail without altering the database`, () => {
        for (const args of [
            ["notes", "--limit", "0"],
            ["notes", "--limit", "1.5"],
            ["notes", "--limit", "1001"],
            ["notes", "--type", "invalid"],
            ["unknown"],
        ]) {
            const result = runCli(["query", ...args]);
            assert.equal(result.status, 1);
            assert.equal(result.stdout, "");
            assert.ok(result.stderr.trim());
        }
        assert.deepEqual(readFileSync(databaseFile), originalDatabase);
    });

    test(`${runtime.name}: querying a missing database fails without creating it`, () => {
        const missingHome = join(project.directory, `missing-home-${runtime.name}`);
        const result = runCli(["query", "notes", "--json"], {
            ...env,
            HOME: missingHome,
            USERPROFILE: missingHome,
            APPDATA: join(missingHome, "AppData", "Roaming"),
        });
        assert.equal(result.status, 1);
        assert.equal(result.stdout, "");
        assert.ok(result.stderr.trim());
        assert.equal(existsSync(getDatabaseFile(missingHome)), false);
    });
}
