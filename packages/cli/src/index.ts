#!/usr/bin/env node
import { parseArgs } from "node:util";
import { handleExpr, handleMathRepl } from "./commands/math.ts";
import { openFile } from "./commands/open-file.ts";
import { openFolder } from "./commands/open-folder.ts";
import { handleQuery } from "./commands/query.ts";
import { resolveOpenTarget } from "./lib/open-target.ts";

const usage = `Usage:
  writeme [--wait|-w] [path]
  writeme open <folder>
  writeme math
  writeme expr <expression>
  writeme query <notes|tags|settings|projects> [options]

Open the current directory as a vault:
  writeme .

Use Writeme as an external editor for CLI prompts (Claude Code, Codex, Pi):
  export EDITOR="writeme --wait"
  export VISUAL="$EDITOR"

Start the CLI from that shell, then use its Ctrl+G external-editor shortcut.
The editor command waits until the file is closed before returning.
Install the CLI from Writeme's desktop command palette, or with:
  npm install --global @writeme.dev/cli

This also installs the interactive math REPL as the math-cli command.
`;

function showHelp(): void {
    console.log(usage);
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2);

    if (argv.includes("--help") || argv.includes("-h")) {
        showHelp();
        return;
    }

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
