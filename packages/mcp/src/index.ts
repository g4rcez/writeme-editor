#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { HELP, parseOptions } from "./config.js";
import { createWorkspaceReader } from "./reader.js";
import { createServer } from "./server.js";
import { SERVER_VERSION } from "./api.js";

try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) {
        process.stdout.write(HELP);
    } else if (options.version) {
        process.stdout.write(`${SERVER_VERSION}\n`);
    } else {
        const reader = createWorkspaceReader(options.reader);
        const handle = serveStdio(() => createServer(reader), {
            onerror: (error) => console.error(`writeme-mcp: ${error.message}`),
        });
        let closing = false;
        const close = async (): Promise<void> => {
            if (closing) return;
            closing = true;
            try {
                await handle.close();
            } finally {
                reader.close();
            }
        };
        process.once("SIGINT", () => {
            void close();
        });
        process.once("SIGTERM", () => {
            void close();
        });
        process.stdin.once("end", () => {
            void close();
        });
    }
} catch (error) {
    console.error(`writeme-mcp: ${error instanceof Error ? error.message : "Startup failed"}`);
    process.exitCode = 1;
}
