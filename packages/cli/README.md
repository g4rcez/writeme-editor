# @writeme.dev/cli

The Writeme CLI for Node.js, Bun, and Deno. The npm package ships portable ESM JavaScript, not a platform-specific executable.

## Use

```sh
npx @writeme.dev/cli expr "1 + 1"
bunx --bun @writeme.dev/cli expr "1 + 1"
deno run -A npm:@writeme.dev/cli expr "1 + 1"
```

Each prints `2`. An invalid expression exits with status 1.

Install with `npm install --global @writeme.dev/cli` to get the `writeme` and `math-cli` commands:

```sh
math-cli
writeme math
writeme expr "1 + 1"
writeme query notes --json
writeme query tags --json
writeme query settings --json
writeme query projects --json
writeme open /path/to/folder
writeme /path/to/note.md
```

`math-cli` starts the interactive math REPL directly; `writeme math` remains available as an alias. `writeme .` opens the working directory as a vault. To use Writeme for prompt editing in terminal coding agents, configure the standard external-editor variables before starting the agent:

```sh
export EDITOR="writeme --wait"
export VISUAL="$EDITOR"
```

Claude Code, Codex, Pi, and other CLIs that launch `$VISUAL` or `$EDITOR` for their Ctrl+G external-editor action will open the temporary prompt in Writeme. `--wait` keeps the agent's editor action open until the Writeme window for that file is closed. Start the agent from the shell where these variables are exported.

On Windows PowerShell, set the variables for the current terminal session before launching the agent:

```powershell
$env:EDITOR = "writeme --wait"
$env:VISUAL = $env:EDITOR
```

Install the platform-matched CLI bundled with the desktop app from its command palette (`Install CLI`), or install the portable npm package with `npm install --global @writeme.dev/cli`. The desktop installer does not require Node.js; the npm package requires Node.js 22.13 or later. If your shell cannot find the desktop-installed command, add `~/.local/bin` to `PATH` (macOS/Linux) and restart the shell.

Math commands work without the desktop app. Open commands need Writeme installed; query commands need its existing SQLite database. Queries open the database read-only.

Node.js and Deno use `node:sqlite`; Bun uses `bun:sqlite`. Node.js must be at least 22.13. Tested with Node.js 24.18, Bun 1.3.14, and Deno 2.4.5.

Deno's `-A` grants all permissions. For restricted use, grant only the permissions needed by the chosen command: SQLite needs file access and FFI; launching the desktop app needs subprocess access; socket and exchange-rate requests need network access; settings and history need environment and file access.

## Develop

Manage this directory independently:

```sh
npm install --workspaces=false
npm run validate --workspaces=false
npm publish --workspaces=false --access public
```

`prepublishOnly` automatically validates the build, source/test types, unit tests, all three runtimes, and isolated tarball installation. All three runtimes must be on PATH. Tests use the installed math dependency and package-local helpers.

Before math's first npm release, use the [local tarball bootstrap](../README.md#cli-before-the-first-math-publication) instead of the initial install. Once math is published, ordinary installation generates a standalone lockfile. The CLI has its own version; update its math dependency range only when compatibility requirements change.

From the repository root:

```sh
npm run build:packages
npm run typecheck --workspace @writeme.dev/cli
npm test --workspace @writeme.dev/cli
npm run test:runtime --workspace @writeme.dev/cli
npm run test:package --workspace @writeme.dev/cli
```

Unit tests use Bun. Runtime tests require all three runtimes on PATH and cover the compiled CLI, expression failure, and SQLite queries.

Installation tests build and pack both the CLI and math dependency, then install the tarballs in a temporary project. They verify both installed executables, the interactive math REPL, history, expression results and errors, query filters and sorting, invalid arguments, and missing database failures in Node.js, Bun, and Deno. Database queries use an isolated temporary home and must leave the database unchanged.

`npm run build:standalone --workspace @writeme.dev/cli` creates standalone `dist/writeme` and `dist/math-cli` binaries for the current platform. These executables are excluded from the npm tarball.

See [publishing](../README.md) for the release sequence.
