# Plan 010: Remove Electron template-loading N+1 reads

> **Executor instructions**: Follow this plan step by step. Run every verification command. If a STOP condition occurs, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 67641c2..HEAD -- src/store/repositories/electron/notes.repository.ts src/store/repositories/browser/notes.repository.ts src/main.ts src/main-process/database.ts src/store`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `67641c2`, 2026-06-14

## Why this matters

Electron database-mode template loading first fetches template metadata, then calls `getOne` once per template to hydrate content. The browser implementation fetches equivalent template rows directly. Removing the 1+N pattern improves performance and reduces IPC/database chatter while preserving filesystem-mode behavior.

## Current state

- `src/store/repositories/electron/notes.repository.ts:270` starts `getTemplates()`.
- `src/store/repositories/electron/notes.repository.ts:271` calls `window.electronAPI.db.notes.getTemplates()` for metadata.
- `src/store/repositories/electron/notes.repository.ts:292-298` maps every template to `this.getOne(n.id)` in non-filesystem mode.
- `src/store/repositories/browser/notes.repository.ts:166-173` fetches templates directly from the Dexie notes collection and parses rows without per-template repository calls.
- Filesystem mode must keep reading content from note files.

## Commands you will need

| Purpose         | Command                     | Expected on success |
| --------------- | --------------------------- | ------------------- |
| Typecheck       | `npm run typecheck`         | exit 0              |
| Tests           | `npm run test -- src/store` | targeted tests pass |
| Full unit suite | `npm run test`              | all unit tests pass |

## Scope

**In scope**:

- `src/store/repositories/electron/notes.repository.ts`
- Electron DB notes IPC/query implementation if `getTemplates` needs full rows
- Tests for electron repository template loading

**Out of scope**:

- Changing template entity shape
- Changing filesystem storage behavior
- Refactoring all repository APIs

## Git workflow

- Branch: `advisor/010-remove-template-loading-n-plus-one`
- Commit message: `perf(store): load electron templates in one query`

## Steps

### Step 1: Locate the Electron DB `notes.getTemplates` implementation

Find where `window.electronAPI.db.notes.getTemplates()` is handled. Determine whether it currently returns metadata only or can safely include full content for database storage mode.

**Verify**: document the handler/query location in implementation notes.

### Step 2: Add a full-row template query for database mode

Modify or add a query that returns all fields needed by `Note.parse` for templates stored in SQLite. Do not affect filesystem mode, which reads content from files when `n.filePath` exists.

**Verify**: targeted repository tests pass.

### Step 3: Remove the non-filesystem `Promise.all(...this.getOne...)` path

In `ElectronNotesRepository.getTemplates()`, parse full rows directly for database mode, mirroring the browser repository shape. Keep the filesystem branch intact.

**Verify**: `npm run typecheck` exits 0.

### Step 4: Validate behavior

Add tests or mocks that assert non-filesystem template loading does not call `getOne` per template. Also verify filesystem mode still reads template content from file paths.

**Verify**: `npm run test -- src/store` and then `npm run test` pass.

## Test plan

- Repository-level tests for database-mode templates with content.
- Repository-level tests for filesystem-mode templates preserving file reads.
- A regression assertion that multiple templates do not produce N calls to `getOne` in database mode.

## Done criteria

- [ ] Electron database-mode template loading uses one full-row query/path.
- [ ] Filesystem-mode template content hydration is unchanged.
- [ ] `npm run typecheck` and relevant tests pass.
- [ ] No public template shape changes.

## STOP conditions

- The DB IPC cannot return full content without a schema migration or broad API change.
- Tests reveal filesystem and database template semantics intentionally differ in a way this plan would erase.

## Maintenance notes

Future repository methods should avoid per-row IPC/database calls when the backend can return full rows in one query. Reviewers should compare browser and electron repository semantics.
