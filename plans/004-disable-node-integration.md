# Plan 004: Disable Node integration in renderer windows

> **Executor instructions**: Follow this plan step by step. Run every verification command. If a STOP condition occurs, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 67641c2..HEAD -- src/main.ts src/preload.ts src/app`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `67641c2`, 2026-06-14

## Why this matters

Electron renderer compromise is much worse when Node integration is enabled. This app already uses a preload script with `contextBridge`, so the intended architecture is to expose narrow APIs rather than Node globals in renderer code.

## Current state

- `src/main.ts:708` creates the main `BrowserWindow`.
- `src/main.ts:711` sets `nodeIntegration: true`.
- `src/main.ts:712` sets `contextIsolation: true`, but Node integration still expands renderer access.
- `CLAUDE.md` states renderer/preload should use IPC APIs and `window.electronAPI.*` must be guarded with `isElectron()`.

## Commands you will need

| Purpose       | Command             | Expected on success                          |
| ------------- | ------------------- | -------------------------------------------- | ------ | ----------- | ---- | ------------------------- | --------------------------------------------------------------------------- |
| Static search | `rg "\b(require     | process                                      | Buffer | \_\_dirname | fs\b | path\b)" src/app src/lib` | no unmediated renderer Node dependency remains, or each result is explained |
| Typecheck     | `npm run typecheck` | exit 0                                       |
| Tests         | `npm run test`      | all unit tests pass                          |
| Manual smoke  | `npm run dev`       | app opens and core Electron flows still work |

## Scope

**In scope**:

- `src/main.ts`
- `src/preload.ts` only if a missing narrow API is required
- Renderer call sites that accidentally rely on Node globals

**Out of scope**:

- Rewriting the IPC architecture
- Removing Electron features
- Changing browser/PWA routing

## Git workflow

- Branch: `advisor/004-disable-node-integration`
- Commit message: `fix(electron): disable renderer node integration`

## Steps

### Step 1: Search for renderer Node global usage

Run the static search command. Inspect results in `src/app` and renderer-shared `src/lib`; distinguish browser-safe globals from Node-only globals.

**Verify**: create a short list of actual Node dependencies or confirm none exist.

### Step 2: Replace Node-global usage with preload APIs if needed

If renderer code needs filesystem, environment, path, or process information, expose the minimum necessary capability through `src/preload.ts` and main IPC. Do not expose generic Node APIs.

**Verify**: `npm run typecheck` exits 0.

### Step 3: Disable Node integration

Set `nodeIntegration: false` in the relevant `BrowserWindow` webPreferences. Check for any secondary BrowserWindows and apply the same principle where appropriate.

**Verify**: `npm run typecheck` and `npm run test` pass.

### Step 4: Manual Electron smoke test

Run `npm run dev` and verify note opening/editing, AI panel open, terminal panel behavior, and filesystem-backed note operations if available.

**Verify**: app opens without renderer errors in devtools/terminal.

## Test plan

- Existing unit tests should still pass.
- Add a small test only if a helper/preload abstraction is introduced.

## Done criteria

- [ ] Main renderer windows use `nodeIntegration: false`.
- [ ] Renderer code does not depend on Node globals except through explicit preload APIs.
- [ ] `npm run typecheck` and `npm run test` pass.
- [ ] Electron smoke test result is recorded.

## STOP conditions

- A critical renderer feature depends on broad Node access and no narrow preload API is obvious.
- Disabling Node integration breaks Electron startup in a way that requires broad architecture changes.

## Maintenance notes

Future Electron features should add narrow IPC/preload APIs. Reviewers should reject re-enabling Node integration as a shortcut.
