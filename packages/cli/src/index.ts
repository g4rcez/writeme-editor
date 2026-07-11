#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { handleExpr, handleMathRepl } from "./commands/math.ts";
import { openFile } from "./commands/open-file.ts";
import { openFolder } from "./commands/open-folder.ts";
import { handleQuery } from "./commands/query.ts";
import { resolveOpenTarget } from "./lib/open-target.ts";

async function main(): Promise<void> {
    const argv = process.argv.slice(2);

    if (argv[0] === "open") {
        if (!argv[1]) {
            console.log("Usage: writeme open <folder>");
            process.exit(1);
        }
        await openFolder(argv[1]);
        return;
    }

    if (argv[0] === "math") {
        await handleMathRepl();
        return;
    }

    if (argv[0] === "expr") {
        const { positionals } = parseArgs({
            args: argv.slice(1),
            allowPositionals: true,
            strict: false,
        });
        await handleExpr({ code: positionals.join(" ") });
        return;
    }

    if (argv[0] === "query") {
        if (!argv[1]) {
            console.log("Usage: writeme query <notes|tags|settings|projects> [options]");
            process.exit(1);
        }
        const { values } = parseArgs({
            args: argv.slice(2),
            options: {
                tag: { type: "string" },
                type: { type: "string" },
                search: { type: "string" },
                limit: { type: "string" },
                note: { type: "string" },
                json: { type: "boolean" },
            },
            strict: false,
        });
        const rawArgs = {
            ...values,
            limit: values.limit !== undefined ? Number(values.limit) : undefined,
        };
        await handleQuery(argv[1], rawArgs);
        return;
    }

    const { values, positionals } = parseArgs({
        args: argv,
        options: {
            wait: { type: "boolean", short: "w" },
        },
        allowPositionals: true,
        strict: false,
    });

    const target = await resolveOpenTarget(positionals[0] ?? null, values.wait === true);

    if (target.type === "folder") {
        await openFolder(target.folderPath);
        return;
    }

    await openFile(target.filePath, target.wait);
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
