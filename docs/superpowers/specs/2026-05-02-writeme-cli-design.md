# writeme CLI — Design Spec

## Context

The project has a working but minimal `bin/writeme` Node.js script that opens files in a running Writeme instance via a Unix socket. It has no type safety, no input validation, and no support for folder-open or database queries. This spec replaces it with a fully typed Bun/TypeScript CLI at `packages/cli`, adds folder workspace opening (VS Code-style), and exposes read-only structured database queries.

---

## Architecture

### Package location

`packages/cli/` — standalone Bun/TypeScript project. No workspace linking to the main app. Own `package.json` and `tsconfig.json`.

### Dependencies

- External: `zod` only
- Built-in: `bun:sqlite`, `util.parseArgs`, `net` (Unix socket), `os`, `path`

### Build

```
bun build --compile src/index.ts --outfile dist/writeme
```

Produces a self-contained binary. Root `package.json` `bin.writeme` updated from `./bin/writeme` to `./packages/cli/dist/writeme`. Old `bin/writeme` file deleted.

### File structure

```
packages/cli/
  package.json
  tsconfig.json
  src/
    index.ts                  # entry: parse top-level command, dispatch
    commands/
      open-file.ts            # writeme [file] [--wait]
      open-folder.ts          # writeme open <folder>
      query.ts                # writeme query <subcommand> [options]
    lib/
      socket-client.ts        # Unix socket connect/send/receive
      db.ts                   # bun:sqlite read-only access + parameterized queries
      paths.ts                # platform-aware paths (socket file, db file)
      launcher.ts             # launch Electron binary if no instance running
    schemas/
      open.ts                 # Zod schemas for open-file and open-folder args
      query.ts                # Zod schemas for all query subcommand args
    types.ts                  # local entity type declarations (notes, tags, settings, projects)
```

---

## Commands

### `writeme [<file>] [--wait]`

Opens `<file>` in the running Writeme instance via Unix socket. If no instance is running, launches the Electron app, waits for the socket to appear (poll 30× / 300ms), then connects. With `--wait`, blocks until the user closes the tab.

If `<file>` is omitted, focuses the running instance window.

### `writeme open <folder>`

Opens `<folder>` as a workspace in a new Writeme BrowserWindow. Sends `{ action: "open-folder", folderPath, requestId }` to the socket. If no instance is running, launches the app first (same poll logic as above).

### `writeme query notes [options]`

Queries the `notes` table directly from SQLite. Options:
- `--tag <hashtag>` — filter by hashtag (JOIN with `hashtags` table on `filename = notes.filePath`)
- `--type <note|quick|read-it-later|template>` — filter by `noteType`
- `--search <text>` — LIKE match on `title` and `content`
- `--limit <n>` — default 20, max 1000
- `--json` — output as JSON array instead of aligned columns

### `writeme query tags [options]`

Queries the `hashtags` table. Options:
- `--note <noteId>` — filter by note ID
- `--json`

### `writeme query settings [--json]`

Lists all rows from the `settings` table as `name = value` pairs.

### `writeme query projects [--json]`

Lists all rows from the `projects` table.

---

## Socket Protocol Extension

Current format (no `action` field) is replaced by a discriminated union.

**CLI → server:**
- `{ action: "open-file", filePath: string | null, wait: boolean, requestId: string }`
- `{ action: "open-folder", folderPath: string, requestId: string }`

**Server → CLI:**
- `{ status: "opened" }` — immediate acknowledgement
- `{ status: "closed" }` — emitted when the tab is closed (open-file --wait only)
- `{ status: "error", message: string }` — new error response

### Changes required in the main app

- `src/main-process/cli-server.ts` — discriminate on `action` field; route `open-folder` to a new handler that fires `app:open-folder` IPC
- `src/main.ts` — handle `app:open-folder`: create a new `BrowserWindow`, load the renderer URL with `/#/folder?path=<encoded>`, pass `mainWindow` reference for tray/focus management
- `src/app/router.tsx` — add `/folder` route
- New renderer page `src/app/pages/folder-workspace.tsx` — reads `?path` query param, sets it as the active project root, renders the existing directory tree component

---

## Security Model

- SQLite opened with `{ readonly: true }` — writes are impossible
- All CLI args validated with Zod before any SQL execution or socket use
- All SQL filters use parameterized prepared statements — no string interpolation
- Socket path derived from `os.homedir()` and a hardcoded app-data subdirectory — never from user input
- Single external dependency (`zod`) — no transitive dependencies, well-audited
- `bun audit` runs as part of the `build` script in `packages/cli/package.json`

---

## Data Flow

```
writeme open notes.md
  → schemas/open.ts (Zod parse)
  → lib/paths.ts (resolve socket path)
  → lib/socket-client.ts (connect or launch + poll)
  → send { action: "open-file", filePath, wait: false, requestId }
  → receive { status: "opened" }
  → exit 0

writeme query notes --tag=work --limit=5
  → schemas/query.ts (Zod parse)
  → lib/paths.ts (resolve db path)
  → lib/db.ts (readonly bun:sqlite, parameterized query)
  → stdout: aligned columns or JSON
  → exit 0
```

---

## Testing

- Vitest unit tests for `lib/db.ts` query builders (parameterization, limit clamping, output formatting)
- Vitest unit tests for Zod schemas (valid inputs pass, invalid inputs throw with useful messages)
- Playwright / manual E2E: launch Writeme, run `writeme <file>`, verify note opens; run `writeme query notes --json`, verify JSON matches DB contents
