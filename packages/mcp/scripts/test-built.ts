import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const packageDirectory = fileURLToPath(new URL("..", import.meta.url));
const entry = process.env.MCP_STDIO_ENTRY ?? fileURLToPath(new URL("../dist/index.js", import.meta.url));
const bun = process.versions.bun ? process.execPath : (process.env.MCP_TEST_BUN ?? "bun");
const runtimes = process.env.MCP_RUNTIME ? [process.env.MCP_RUNTIME] : ["node", "bun", "deno"];
await access(entry);
let failed = false;
for (const runtime of runtimes) {
    console.log(`\nTesting built MCP package with ${runtime}`);
    const code = await new Promise<number>((resolve) => {
        const child = spawn(bun, ["test", "tests/contract.test.ts", "tests/stdio.test.ts"], {
            cwd: packageDirectory,
            env: { ...process.env, MCP_STDIO_ENTRY: entry, MCP_RUNTIME: runtime },
            stdio: "inherit",
        });
        child.once("error", (error) => {
            console.error(`Unable to run required ${runtime} suite: ${error.message}`);
            resolve(1);
        });
        child.once("close", (code, signal) => {
            if (signal) console.error(`Required ${runtime} suite terminated by ${signal}`);
            resolve(code ?? 1);
        });
    });
    if (code !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
