# Writeme MCP

Read saved Writeme notes and preferences from an MCP client over stdio. The desktop app can be open or closed. This server does not connect to the editor UI or change notes, preferences, databases, files, or tabs.

## Install and run

Supported runtimes: **Node.js 22.13+**, **Bun 1.3+**, or **Deno 2.2+** (**Deno 2.4.5+ on Windows**). Older Windows Deno versions leave SQLite snapshot files locked after closing them. The CLI uses the runtime's built-in SQLite support; it does not require an external SQLite executable or a native npm addon. A saved desktop Writeme profile must already exist. Browser-only IndexedDB profiles are not supported.

Install a published version globally with npm:

```sh
npm install --global @writeme.dev/mcp
writeme-mcp --profile production
```

Or launch without a global installation:

```sh
npm exec --yes --package=@writeme.dev/mcp -- writeme-mcp --profile production
npx --yes @writeme.dev/mcp --profile production
bunx --bun @writeme.dev/mcp --profile production
```

The executable has a Node shebang. `bunx --bun` explicitly selects Bun instead. Registry commands require a published version; the local tarball workflow below also works before publication. No publishing action is part of the verification commands.

An MCP client configuration using npm is:

```json
{
    "mcpServers": {
        "writeme": {
            "command": "/absolute/path/to/npx",
            "args": ["--yes", "@writeme.dev/mcp", "--profile", "production"]
        }
    }
}
```

Use `command -v npx` to find the executable. GUI clients may not inherit your shell PATH, and JSON configuration does not automatically expand `~` or `$HOME`. For an installed local package, set `command` to the absolute `node` or `bun` path and use the absolute `node_modules/@writeme.dev/mcp/dist/index.js` path as the first argument. No port, API key, or running editor connection is required. Standard output is reserved for MCP messages; runtime warnings and server diagnostics go to standard error.

### Deno with scoped filesystem permissions

Install the package in a local npm project first:

```sh
npm install @writeme.dev/mcp
```

From that project, run the npm CLI export. The following POSIX-shell example uses existing absolute directories; replace all placeholders:

```sh
TMPDIR=/absolute/mcp-temp deno run --node-modules-dir=manual \
  --allow-read=/absolute/npm-project,/absolute/writeme-profile,/absolute/notes,/absolute/mcp-temp \
  --allow-write=/absolute/mcp-temp --allow-env --allow-sys \
  npm:@writeme.dev/mcp/cli \
  --data-dir /absolute/writeme-profile --workspace /absolute/notes
```

Use canonical absolute paths rather than symlink aliases (for example, macOS may resolve `/var` to `/private/var`). Read access covers the installed package, saved profile, workspace, and snapshot directory. Add any separately configured template/quick-note roots to the read list. Only the temporary snapshot directory needs write permission. Environment/system queries support runtime and profile discovery; the server does not need network, subprocess, or FFI permissions. On Windows, configure `TEMP`/`TMP` to the allowed snapshot directory using your shell's environment syntax. For an MCP client, put these Deno flags in `args` and the temporary directory setting in its environment configuration.

### Local development and tarballs

From the repository root:

```sh
npm install
npm run build --workspace @writeme.dev/mcp
node packages/mcp/dist/index.js --help
bun packages/mcp/src/index.ts --help
npm pack --workspace @writeme.dev/mcp
```

`npm pack` runs the build through `prepack`. Install the resulting `writeme.dev-mcp-0.1.0.tgz` into a separate project with `npm install /absolute/path/to/writeme.dev-mcp-0.1.0.tgz`, then use its installed executable or exports. The tarball includes JavaScript, declarations, source maps, the versioned contract, documentation and license; it does not need the editor checkout at runtime.

### Library exports

Importing the package root does not start a stdio server or read a profile:

```ts
import { createWorkspaceReader, createServer, CONTRACT_VERSION } from "@writeme.dev/mcp";

const reader = createWorkspaceReader({ profile: "production", dataDir: "/absolute/writeme-profile" });
const server = createServer(reader);
// Connect the server to your chosen MCP transport when ready.
```

The root also exports request/output schemas and TypeScript types. Use `@writeme.dev/mcp/cli` to execute the CLI, and `@writeme.dev/mcp/contract/v1` to resolve the published JSON contract. TypeScript applications consuming the SDK-backed server types should install `@types/node` as a development dependency. Package consumption does not require Bun types.

### Profile and workspace selection

- `--profile production` (default) selects `writeme`; `--profile development` selects `writeme-dev`.
- Profile directories default to `~/Library/Application Support/<profile>` on macOS, `%APPDATA%/<profile>` on Windows, and `$XDG_CONFIG_HOME/<profile>` or `~/.config/<profile>` on Linux.
- `--data-dir /absolute/profile/directory` overrides the directory containing `writeme.sqlite`. Supply the directory, not the database filename. The profile flag remains a descriptive label when this override is used.
- `--workspace /absolute/workspace` overrides the saved workspace selection. Otherwise the saved `directory` preference selects filesystem mode; an unset directory selects SQLite mode.

For example, append `"--data-dir", "/absolute/test-profile", "--workspace", "/absolute/notes"` to `args` to scope a connection explicitly. Use separate client entries for different profiles/workspaces.

Filesystem mode reads canonical Markdown/MDX and LaTeX (`.tex`/`.latex`) files rather than stale SQLite content. SQLite mode reads saved note content from the database. The server takes a temporary database/WAL snapshot and reads that copy; it never migrates or initializes a profile. If writes repeatedly prevent a stable snapshot, retry the reported `DATABASE_BUSY` error. Missing or incompatible databases produce actionable errors instead of empty success.

## Tools and resources

| Tools                         | Saved data                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| `get_status`, `get_workspace` | Profile, storage mode, selected roots, capabilities, warnings                                |
| `list_notes`, `search_notes`  | Note metadata; query, tag, project, note type, favorite, folder filters                      |
| `get_note`                    | Metadata, serialized metadata, content, heading outline, named section, Excalidraw structure |
| `list_tags`, `get_note_links` | Tags, outgoing links, backlinks                                                              |
| `get_settings`                | Allowlisted preferences and descriptions; credentials omitted                                |
| `list_projects`               | Saved projects                                                                               |
| `list_groups`, `get_group`    | Saved note groups and membership                                                             |
| `list_views`, `get_view`      | Saved views                                                                                  |
| `list_tabs`                   | Persisted flat tab order, with `live: false`                                                 |
| `list_templates`              | Saved template notes                                                                         |
| `get_comments`                | Comments from saved companion notes                                                          |

Resources: `writeme://workspace` and `writeme://notes/{ref}`. Percent-encode note refs in resource URLs. The note resource returns metadata and the first sanitized content chunk; continue using `get_note` when `nextOffset` is present.

A note reference is its saved UUID or the returned root-prefixed relative reference, such as `workspace:plans/launch.md`, `templates:review.md`, or `quicknotes:idea.md`. Prefer returned refs rather than constructing absolute paths. Canonical root checks reject symlink escapes; hidden/trash files and deleted notes are excluded. Missing backing files are reported as unavailable, never replaced with stale database text. Linked notes do not authorize reading arbitrary files outside the selected roots.

Projects, tabs and group membership are filtered against workspace scope where supported. Saved views are **profile-scoped**, not workspace-specific; check `viewsProfileScoped` in capabilities. Current persisted tabs are a flat list. There is no live active tab, selection, split layout, or unsaved buffer access. Inspect capabilities rather than treating an unavailable collection as empty.

## Content and limits

Every request reads saved state again. Revisions and observation timestamps describe the snapshot; a series of separate calls is not an atomic workspace transaction.

Responses identify `contractVersion: "1.0"`. Each tool advertises a validated output schema. Note representations identify their `responseFormat`; tool errors contain a stable code, safe message, and retry policy in both text and structured JSON. See [CONTRACT.md](./CONTRACT.md) for the client contract and compatibility policy.

- Lists use `offset` and `limit` (default 50, maximum 200). Follow `nextOffset` until complete.
- Save `snapshotRevision` from the first response and pass it as `expectedRevision` on later pages or related reads. A `REVISION_MISMATCH` means the saved workspace changed; restart the read. Treat revisions as opaque strings. The note's `revision` describes its own saved content and is not the workspace precondition.
- Content uses `contentOffset` and `contentLimit` (default 16,000, maximum 64,000 JavaScript string characters).
- `get_note.format` accepts `metadata` (default), `metadata_json`, `content`, `outline`, `section`, or `excalidraw`. `section` requires the exact heading text; duplicate headings return an ambiguity error.
- Default content removes embedded asset payloads. Structured Excalidraw output omits embedded files and pages elements. Binary attachments, PDF bytes, audio, and image files are not served.
- Explicit `raw: true` returns canonical saved textual content, including embedded text payloads, with content pagination. Use it only when those original bytes represented as text are needed; it bypasses ordinary content sanitization. It does not permit arbitrary filesystem access.
- `metadata_json` provides paginated serialized metadata when structured nested values exceed response limits. It is sanitized even with `raw: true`.
- Notes larger than 10 MiB are unavailable. Nested structures may be bounded/redacted. Check `complete`, `snapshotComplete`, `truncated`, warnings, and capabilities before treating results as exhaustive.
- Settings are allowlisted; credential fields and unknown preferences are omitted. Note content itself may contain sensitive user-authored information, particularly with raw reads.

## Verification

Manage this directory independently:

```sh
npm ci --workspaces=false
npm run validate --workspaces=false
npm publish --workspaces=false --access public
```

`prepublishOnly` automatically runs `validate`: all `check` steps, package-test typechecking, and isolated tarball installation. Failed checks block publication. Test helpers and compiler configuration are package-local; Node.js, Bun, and Deno are required. MCP versions are independent of math, CLI, and editor. Native Electron acceptance remains a separate application integration check. Package installation evidence is relative to this directory unless `MCP_PACKAGE_EVIDENCE` is set.

From the repository root:

```sh
npm run check --workspace @writeme.dev/mcp
npm run test:package --workspace @writeme.dev/mcp
npm run test:e2e --workspace @writeme.dev/mcp
```

`check` runs typechecking (including maintenance scripts), package-local lint and formatting checks, contract drift checks, unit/storage tests, source protocol tests, the build, and contract/shutdown tests against the built entry. Independent contract tests launch the selected runtime for SQLite and filesystem fixtures, discover all 16 tools, validate responses against [contract/v1.json](./contract/v1.json) with JSON Schema, exercise resources/errors/revision changes, and compare saved file hashes. Tests never regenerate their expected baseline.

`test:package` performs a normal npm pack/install into an isolated project, checks executable and public exports, compiles a strict TypeScript consumer, and runs all 16 tool contracts against the installed entry on Node, Bun, and Deno. All three runtimes must be available; missing runtimes fail rather than skip. The test also verifies Deno with scoped read/write permissions. Installed-package evidence is written under `.omo/evidence/mcp-package`.

The dedicated [MCP workflow](../../.github/workflows/mcp.yml) schedules these checks on Linux, macOS, and Windows, plus native Electron acceptance on macOS. Local verification proves the platforms actually exercised; a workflow definition alone does not establish platform support.

The Playwright test launches the packaged Electron app in an isolated profile, saves a real note through the editor, changes autosave through the native settings boundary, types an unsaved marker, and checks actual stdio reads with the app open and closed in both SQLite and filesystem modes. It records screenshots and JSON results under `.omo/evidence/mcp-integration/native`. It never uses your normal profile. Set `MCP_NATIVE_ENTRY` to an alternate absolute compiled Electron main entry, `MCP_BUN` to an absolute Bun executable, or `MCP_STDIO_ENTRY` to the server entry to test. The default native entry is `out/writeme-<platform>-<arch>/.../app.asar/.vite/build/main.js`, which requires an existing packaged build.

## Maintenance structure

- `src/api.ts` owns versioned schemas, schema-derived request types, representation variants, descriptions, and annotations.
- `src/errors.ts` owns application error codes and safe serialization. Protocol/resource failures follow the SDK's JSON-RPC error surface.
- `src/tools/read.ts` owns deterministic saved-state projections, pagination, and revision preconditions.
- `src/reader.ts` and `src/storage/` own standalone read-only storage and access checks; they do not import editor repositories.
- `src/server.ts` owns discovery, runtime contract validation, and stdio resource/tool integration.
- `tests/` separates storage/config/document regression checks from independent consumer contracts. `package-tests/` verifies isolated npm installations. `e2e/` checks the packaged editor's actual persistence.
- `scripts/contract.ts` exports/checks the baseline only when explicitly requested. `scripts/test-built.ts` exercises the release entry across runtimes without shell-specific environment syntax.

When storage or SDK dependencies change, run every verification layer. Review incompatible application schema changes before updating the baseline, and record migration guidance for a new major contract. This process is described in [CONTRACT.md](./CONTRACT.md).
