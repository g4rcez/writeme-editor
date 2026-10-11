import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const runtime = process.env.MCP_RUNTIME ?? process.execPath;
const runtimeName = path.basename(runtime).replace(/\.exe$/i, "");
const runtimeArgs =
    runtimeName === "deno"
        ? ["run", "--node-modules-dir=manual", "--allow-read", "--allow-write", "--allow-env", "--allow-sys"]
        : [];
const stdioCwd = process.env.MCP_STDIO_CWD ?? path.resolve(import.meta.dir, "..");
const stdioEntry =
    process.env.MCP_STDIO_ENTRY ??
    path.join(stdioCwd, process.env.MCP_RUNTIME ? "dist/index.js" : "src/index.ts");

function unexpectedStderr(stderr: string): string {
    const sqliteWarning =
        /^\(node:\d+\) ExperimentalWarning: SQLite is an experimental feature and might change at any time\r?\n/gm;
    if (!sqliteWarning.test(stderr)) return stderr;
    return stderr
        .replace(sqliteWarning, "")
        .replace(/^\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)\r?\n/gm, "");
}

test("actual stdio initialization, tools, resources, errors and shutdown leave saved files unchanged", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "writeme-stdio-"));
    const database = new Database(path.join(directory, "writeme.sqlite"));
    database.exec(`CREATE TABLE notes(id TEXT, title TEXT, content TEXT, noteType TEXT, filePath TEXT);
        CREATE TABLE settings(name TEXT, value TEXT);
        INSERT INTO notes VALUES('saved-note', 'Saved note', '# Saved\nCanonical body', 'note', NULL);
        INSERT INTO settings VALUES('autosave', 'false');`);
    database.close();
    const hashes = async (): Promise<Record<string, string>> =>
        Object.fromEntries(
            await Promise.all(
                (await readdir(directory)).sort().map(async (name) => [
                    name,
                    createHash("sha256")
                        .update(await readFile(path.join(directory, name)))
                        .digest("hex"),
                ]),
            ),
        );
    const before = await hashes();
    const transport = new StdioClientTransport({
        command: runtime,
        cwd: stdioCwd,
        args: [...runtimeArgs, stdioEntry, "--data-dir", directory],
        stderr: "pipe",
    });
    const client = new Client({ name: "writeme-acceptance", version: "1.0.0" });
    let stderr = "";
    transport.stderr?.on("data", (data) => {
        stderr += String(data);
    });
    try {
        await client.connect(transport);
        expect(client.getServerVersion()?.name).toBe("writeme");
        const tools = await client.listTools();
        expect(tools.tools.map((tool) => tool.name)).toContain("get_note");
        expect(tools.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
        const note = await client.callTool({
            name: "get_note",
            arguments: { ref: "saved-note", format: "content", raw: true },
        });
        expect(note.structuredContent).toMatchObject({
            source: "sqlite",
            raw: true,
            content: { text: "# Saved\nCanonical body" },
        });
        const resources = await client.listResources();
        expect(resources.resources.map((resource) => resource.uri)).toContain("writeme://workspace");
        const resource = await client.readResource({
            uri: "writeme://notes/saved-note",
        });
        const resourceContent = resource.contents[0];
        if (!resourceContent || !("text" in resourceContent)) throw new Error("Expected text note resource");
        expect(JSON.parse(resourceContent.text).content.text).toBe("# Saved\nCanonical body");
        const missing = await client.callTool({
            name: "get_note",
            arguments: { ref: "missing" },
        });
        expect(missing.isError).toBe(true);
        const invalid = await client.callTool({
            name: "get_note",
            arguments: { ref: "saved-note", contentLimit: -1 },
        });
        expect(invalid.isError).toBe(true);
        const pid = transport.pid;
        expect(pid).toBeNumber();
        await client.close();
        expect(() => process.kill(pid!, 0)).toThrow();
        expect(unexpectedStderr(stderr)).toBe("");
        expect(await hashes()).toEqual(before);
    } finally {
        await client.close();
        await rm(directory, { recursive: true, force: true });
    }
});

test("stdin EOF exits cleanly after MCP initialization", async () => {
    const child = spawn(runtime, [...runtimeArgs, stdioEntry], { cwd: stdioCwd, stdio: "pipe" });
    let stdout = "";
    let stderr = "";
    let firstLineResolve: (value: string) => void = () => {};
    let firstLineReject: (error: Error) => void = () => {};
    const firstLine = new Promise<string>((resolve, reject) => {
        firstLineResolve = resolve;
        firstLineReject = reject;
    });
    const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
        child.once("error", (error) => {
            firstLineReject(error);
            reject(error);
        });
        child.once("close", (code, signal) => {
            if (!stdout.includes("\n"))
                firstLineReject(new Error(`Runtime exited before initialization: ${stderr}`));
            resolve({ code, signal });
        });
    });
    child.stdout.on("data", (data) => {
        stdout += String(data);
        const newline = stdout.indexOf("\n");
        if (newline >= 0) firstLineResolve(stdout.slice(0, newline));
    });
    child.stderr.on("data", (data) => {
        stderr += String(data);
    });
    const timeout = setTimeout(() => {
        firstLineReject(new Error("Runtime did not complete EOF shutdown within 10 seconds"));
        child.kill("SIGKILL");
    }, 10000);
    try {
        child.stdin.write(
            JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: {
                    protocolVersion: "2025-06-18",
                    capabilities: {},
                    clientInfo: { name: "eof-test", version: "1" },
                },
            }) + "\n",
        );
        expect(JSON.parse(await firstLine)).toMatchObject({
            jsonrpc: "2.0",
            id: 1,
            result: { serverInfo: { name: "writeme" } },
        });
        child.stdin.end();
        expect(await exit).toEqual({ code: 0, signal: null });
        expect(unexpectedStderr(stderr)).toBe("");
        expect(stdout.trim().split("\n")).toHaveLength(1);
    } finally {
        clearTimeout(timeout);
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        await exit;
    }
}, 15000);
