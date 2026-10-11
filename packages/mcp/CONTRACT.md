# MCP application contract v1

Writeme exposes a saved-state, read-only application contract over MCP stdio. Successful tool responses and domain error envelopes identify this contract with `contractVersion: "1.0"`. This version is separate from the MCP protocol version negotiated during initialization and the package/server version.

`contract/v1.json` is the checked-in compatibility baseline for tool input schemas, output schemas, machine-readable annotations, resource URI templates, and the error envelope. The protocol tests load that file independently of the implementation schemas. A test run must never regenerate its own expected contract.

## Compatibility policy

Within contract v1, preserve existing tool names, required input fields, defaults, accepted types and ranges, response field meanings, error codes, and resource semantics. Adding an optional output field is compatible: clients should ignore unknown output properties. Clients must not require undocumented fields, assume property order, or parse human descriptions/messages as identifiers.

Inputs are strict. Unknown argument names are errors, so misspelled pagination, filters, or preconditions cannot silently change query behavior. Adding an optional input is a deliberate reviewed contract change: clients must discover support from `tools/list` before sending it to an older server. Removing or renaming a field/tool, changing its type or meaning, adding required input, or narrowing accepted values requires a new major contract and migration guidance. An additive schema change still requires review of the baseline; the automated drift test intentionally fails until that review is recorded in code.

Description prose is unpinned. The schema comparison ignores `description`, `title`, `examples`, and `$comment`; it keeps machine constraints, required keys, enum values, defaults, annotations, and input/output structure. Read-only and destructive annotations are part of the machine contract.

## Client reads and pagination

1. Initialize MCP and discover tools/capabilities.
2. Call a tool without `expectedRevision` to begin a read. Save the returned `snapshotRevision`.
3. Send that opaque revision string as `expectedRevision` on subsequent pages/chunks or related tool reads. Every tool supports this optional precondition.
4. Follow `nextOffset` using the appropriate pagination family: list `offset`/`limit`, or note `contentOffset`/`contentLimit`.
5. If a call returns `REVISION_MISMATCH`, discard accumulated pages for that read and restart from the first page without a precondition. Do not combine pages from different revisions.

`get_note.responseFormat` identifies the returned representation: `metadata`, `metadata_json`, `content`, `outline`, `section`, or `excalidraw`. Each variant has a published output schema with its required fields. A raw Excalidraw request returns the `content` representation containing canonical saved text. Section input requires a nonempty section name in the published input schema.

`snapshotRevision` identifies the saved workspace snapshot shared across tool results. `revision` retains its existing meaning: note representations can carry the per-note revision, while aggregate representations carry the workspace revision. Always use `snapshotRevision` for the precondition. `observedAt` is observation time, not a transaction ID or freshness guarantee.

The precondition detects a changed saved snapshot; it does not hold a transaction open across calls or freeze the running editor. A later request can return a newer snapshot. A resource read has no argument-based precondition; clients needing a coherent multi-page read should use tools and `expectedRevision`.

`complete`, `snapshotComplete`, nested pagination, warnings, and capabilities have distinct meanings. A page can be successfully returned yet incomplete. Unavailable optional storage collections produce explicit errors. Saved tab order is a flat persisted list, and views remain profile-scoped. No contract version grants access to active selection, unsaved buffers, or live split layouts.

## Errors

Domain/tool errors use an MCP tool result with `isError: true`. Its text content is the same JSON object as `structuredContent`, containing `contractVersion` and an `error` object. Clients branch on `error.code` and `error.retryable`, not the human message.

| Code                | Meaning                                                            | Client action                                            |
| ------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| `INVALID_ARGUMENT`  | Arguments fail the strict schema, bounds, or required section rule | Correct the input; do not retry unchanged                |
| `NOT_FOUND`         | No matching saved note, section, group, or view                    | Refresh discovery or correct the reference               |
| `UNAVAILABLE`       | Optional saved collection is unavailable in the selected profile   | Inspect capabilities/profile compatibility               |
| `REVISION_MISMATCH` | The expected snapshot is no longer current                         | Restart the complete read without the stale precondition |

These errors report `retryable: false`: repeating an unchanged request is not recovery. Validation issues identify paths and issue codes without copying rejected input values. Clients should surface messages as explanatory text while preserving codes for program logic. Other read/storage errors are described by the published error schema and their returned retryability.

MCP protocol errors are separate: malformed JSON-RPC, unsupported methods, unknown tool names, and invalid protocol messages are handled by the MCP SDK. They need not have the application tool envelope. Resource read failures also travel through JSON-RPC exceptions, rather than a tool `isError` result. The application read boundary places its versioned error envelope in the JSON-RPC error `data` field; for example, a missing saved note yields `data.error.code: "NOT_FOUND"`. Unknown tools and malformed protocol/resource requests remain protocol failures and need not carry that application envelope. There are no HTTP status codes, endpoints, redirects, or REST URLs to interpret.

Familiar REST principles still apply: stable identifiers, explicit representations, bounded pagination, discoverable capabilities, deterministic reads, and revision preconditions. Here these are MCP tool arguments/results and resource URIs. Read-only annotations describe behavior; they do not substitute for validation or scope enforcement.

## Review and release procedure

1. Change implementation schemas and behavior intentionally.
2. Run `npm run contract:check --workspace @writeme.dev/mcp` and the existing baseline tests before updating `contract/v1.json`. Review the failure as a contract diff, not a reason to automatically overwrite expected data.
3. Classify each changed input/output constraint, field, error, annotation, and resource as compatible or breaking. Check older clients, raw/sanitized semantics, pagination, secret exclusions, and storage modes.
4. Update the checked-in manifest with `npm run contract:update --workspace @writeme.dev/mcp` only after the compatibility decision. A breaking change needs a new major contract and client migration instructions. Keep the earlier contract fixtures available for supported versions.
5. Run source and built stdio tests, typecheck/build, and native acceptance against a current packaged editor. Record actual artifacts and environment limitations before release.

## Support and verification matrix

| Layer                    | What it proves                                                                                                                                              | Invocation from repository root                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Fast unit/storage        | Reader safety, schema/config parsing, sanitization, representation helpers                                                                                  | `npm run test --workspace @writeme.dev/mcp`                                                       |
| Source protocol contract | Separate runtime process; initialization/discovery; all 16 tools, schemas, errors, resources, both storage modes, stale revision rejection, unchanged files | `bun test packages/mcp/tests/contract.test.ts`                                                    |
| Built protocol contract  | Same independent client assertions against the release entry                                                                                                | `MCP_STDIO_ENTRY="$PWD/packages/mcp/dist/index.js" bun test packages/mcp/tests/contract.test.ts`  |
| Installed npm package    | Normal prepack/install in an isolated project; exports/declarations/executable; all tools and both storage modes on Node/Bun/Deno; scoped Deno permissions  | `npm run test:package --workspace @writeme.dev/mcp`                                               |
| Native editor acceptance | Real packaged Electron note save, settings persistence, unsaved exclusion, app-open/app-closed reads in SQLite and filesystem modes                         | `npm exec -- playwright test --config packages/mcp/playwright.config.ts`                          |
| Release preparation      | Compile server and validate TypeScript; rerun built/native layers                                                                                           | `npm run typecheck --workspace @writeme.dev/mcp` and `npm run build --workspace @writeme.dev/mcp` |

The contract fixtures include Markdown sections/links/tags, canonical Excalidraw Markdown and omitted embedded assets, LaTeX, meeting metadata, comments, templates, settings with secret exclusions, projects, groups/membership, views, tabs, and encoded filesystem refs. Tests compare actual JSON text with structured results and validate outputs against the independent manifest. File hashes are checked around reads; test-initiated changes are separately bracketed when testing stale snapshots and unavailable collections.

Passing source tests alone does not prove a release bundle or native profile works. Native acceptance requires a packaged Electron build and permission to launch it. Platform coverage is limited to environments where that suite was actually run; the configuration's platform-derived path is not proof that every platform was exercised.

## Design references

The [MCP tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) defines discovery, structured output schemas, annotations, and the distinction between tool and protocol errors. The [Microsoft API design guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design) informs stable identifiers, explicit representations, bounded pagination, and versioning. This package applies those principles to stdio MCP; it does not expose an HTTP REST service.

## Distribution and runtime support

The npm package targets Node.js 22.13+, Bun 1.3+, and Deno 2.2+. The distributed JavaScript uses built-in SQLite through a runtime adapter; the package does not require the editor workspace, Bun-specific declaration imports, or a native npm addon. Its root export is a side-effect-free library entry; `./cli` starts the stdio application. The executable's Node shebang is intentional; select Bun with `bunx --bun`, and Deno with `deno run ... npm:@writeme.dev/mcp/cli`.

Public TypeScript declarations expose the server, reader, request/output schemas, and contract types. SDK-backed Node server types require a consumer's development `@types/node` dependency. Strict consumer typechecking must resolve the installed tarball and its installed dependencies, with no repository aliases or workspace links.

Release validation must pack through the normal `prepack` build, install the tarball into an unrelated temporary project, verify the allowlisted files and executable mode, and run the full protocol contract in both storage modes with each supported runtime. All required runtime executables must be available; a skipped runtime is not a passing release check. Runtime version ranges are the support target; evidence must record the exact versions actually executed and avoid implying that every supported version/platform was tested locally.

The installed server runs without network permission after dependency installation. Deno needs explicit read access to the package/profile/workspace roots, write access to its temporary snapshot directory, and environment/system-query permissions. Verification includes a scoped filesystem-permission run without network, subprocess, or FFI grants. Publication is a separate user-authorized action; packing and local installation do not publish a release.
