# Plan 001: Constrain renderer filesystem IPC to approved roots

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If a STOP condition occurs, stop and report — do not improvise. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 67641c2..HEAD -- src/preload.ts src/ipc/notes.ipc.ts src/store/settings.ts src/store/repositories/electron/notes.repository.ts src/lib`
> If any in-scope file changed, compare the excerpts below against live code before proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `67641c2`, 2026-06-14

## Why this matters

The renderer currently exposes broad filesystem IPC calls that accept absolute paths and execute in the privileged main process. If renderer state is compromised, or if a malicious note/plugin path reaches these APIs, the app can read, write, move, or recursively delete files outside the active workspace. Writeme supports filesystem-backed notes, so the fix must preserve legitimate workspace access while rejecting paths outside approved roots.

## Current state

- `src/preload.ts` exposes filesystem APIs directly to the renderer:
  - `src/preload.ts:82` `writeFile(filePath, content)` invokes `fs:writeFile`.
  - `src/preload.ts:100` `deleteFile(filePath)` invokes `fs:deleteFile`.
- `src/ipc/notes.ipc.ts` performs privileged operations on renderer-provided paths:
  - `src/ipc/notes.ipc.ts:95` handles `fs:writeFile`.
  - `src/ipc/notes.ipc.ts:98-100` creates the parent directory and writes the file.
  - `src/ipc/notes.ipc.ts:197-200` handles `fs:deleteFile` using `fs.rm(filePath, { recursive: true, force: true })`.
- Product/architecture constraints:
  - `CLAUDE.md` says Electron mode may persist notes as `.md` files on disk.
  - `CLAUDE.md` also warns that `storageDirectory` and note identity are semantically different; do not use directory paths as logical note IDs.

## Commands you will need

| Purpose         | Command                                                                   | Expected on success          |
| --------------- | ------------------------------------------------------------------------- | ---------------------------- |
| Typecheck       | `npm run typecheck`                                                       | exit 0, no TypeScript errors |
| Tests           | `npm run test -- src/lib/attachment-paths.test.ts` plus any new test file | all targeted tests pass      |
| Full unit suite | `npm run test`                                                            | all unit tests pass          |

## Scope

**In scope**:

- `src/ipc/notes.ipc.ts`
- New helper/test files under `src/lib/` or `src/main-process/` for path authorization
- Minimal call-site adjustments required to pass an approved workspace root/grant

**Out of scope**:

- Changing note identity semantics
- Redesigning storage modes
- Implementing trash/recovery; see plan 012
- Broad renderer refactors unrelated to filesystem IPC

## Git workflow

- Branch: `advisor/001-constrain-filesystem-ipc`
- Commit message style: conventional commits are used in recent history; use e.g. `fix(security): constrain filesystem IPC paths`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Introduce a main-process path authorization helper

Create a small, unit-tested helper that resolves real paths and verifies that requested paths are inside approved roots. It must reject traversal and symlink escapes. Prefer a pure helper that accepts `requestedPath` and `allowedRoots` so it can be tested without Electron.

**Verify**: targeted test command for the new helper → tests pass for inside-root, `..` traversal, sibling-prefix path (`/tmp/root2` vs `/tmp/root`), and symlink escape cases.

### Step 2: Define the allowed roots for filesystem IPC

Wire the helper into `src/ipc/notes.ipc.ts`. Use the selected workspace/storage directory as the normal allowed root. Keep explicit picker/open-file grants separate if existing flows legitimately open files outside the workspace. If there is no trustworthy root available for a destructive operation, reject the operation with `{ success: false, error: <safe message> }`.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Gate every renderer-provided filesystem path

Apply authorization before `writeFile`, `writeImage`, `readFile`, `readBinaryFile`, `statFile`, `mkdir`, `deleteFile`, `moveFile`, `readDir`, and `readDirRecursive` if those handlers accept renderer-provided paths. For `moveFile`, authorize both source and destination. Preserve return shapes.

**Verify**: new IPC/helper tests pass; `npm run typecheck` exits 0.

### Step 4: Smoke-test storage flows manually if Electron is available

In Electron dev mode, verify filesystem storage can still create, edit, move/rename, and delete notes inside the selected workspace. Do not run destructive tests outside a temporary workspace.

**Verify**: record the manual smoke result in the PR/summary.

## Test plan

- Add focused tests for the path authorization helper.
- If practical, add tests for the IPC handler wrapper behavior without launching Electron.
- Include traversal, symlink, delete, move source/destination, and image-write boundaries.

## Done criteria

- [ ] Renderer-provided filesystem IPC paths are rejected outside approved roots.
- [ ] Existing success/error IPC return shapes are preserved.
- [ ] `npm run typecheck` exits 0.
- [ ] Relevant new tests pass, and `npm run test` passes or any unrelated failures are documented.
- [ ] No files outside the in-scope list are modified except `plans/README.md` status.

## STOP conditions

- You cannot identify a trustworthy workspace root or explicit file-picker grant source.
- The fix requires changing note IDs or storage-mode semantics.
- A legitimate flow requires arbitrary filesystem access; report the flow and propose a narrower grant model.

## Maintenance notes

Trash/recovery, import/export, image paste, and read-it-later attachments will all interact with this boundary. Reviewers should scrutinize path normalization, symlink behavior, and destructive operations most closely.
