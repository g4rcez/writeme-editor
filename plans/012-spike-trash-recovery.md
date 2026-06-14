# Plan 012: Spike trash/recovery semantics across storage modes

> **Executor instructions**: This is a design/spike plan, not a full implementation plan. Produce a clear design artifact and only prototype if needed. Run verification commands if code is touched. If a STOP condition occurs, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 67641c2..HEAD -- README.md PRODUCT.md src/store src/ipc/notes.ipc.ts src/app`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-constrain-filesystem-ipc.md
- **Category**: direction
- **Planned at**: commit `67641c2`, 2026-06-14

## Why this matters

Writeme is positioned as an external brain for users who keep it open all day. Accidental deletion is a trust problem in that kind of tool. The README roadmap already lists a Trash System, but the app has multiple storage modes, so deletion semantics need to be designed before implementation.

## Current state

- `PRODUCT.md:11` says users use writeme as their external brain.
- `README.md:125` lists “Trash System: Implementation of a Trash/Recycle Bin for deleted notes.”
- `src/store/repositories/electron/notes.repository.ts:300+` already contains filesystem-mode delete behavior that moves files toward a `.trash` path; inspect live code before relying on it.
- Plan 001 must settle workspace-root filesystem constraints before trash behavior expands destructive file operations.

## Commands you will need

| Purpose   | Command                     | Expected on success                              |
| --------- | --------------------------- | ------------------------------------------------ | ---------- | -------- | --------- | ------------- | ----------------------------------- |
| Recon     | `rg "trash                  | delete\(                                         | deleteFile | moveFile | deletedAt | restore" src` | records current deletion/trash code |
| Typecheck | `npm run typecheck`         | exit 0 if code prototype is touched              |
| Tests     | `npm run test -- src/store` | targeted tests pass if code prototype is touched |

## Scope

**In scope**:

- A design note under `plans/trash-spike-notes.md` or appended to this plan during execution
- Repository semantics for browser/Dexie, Electron/SQLite, and filesystem mode
- UI/UX flow for delete, restore, permanent delete, and empty trash

**Out of scope**:

- Shipping the full trash feature in this plan
- Broad note model rewrites without a follow-up implementation plan
- Destructive migration/backfill without explicit approval

## Git workflow

- Branch: `advisor/012-spike-trash-recovery`
- Commit message if docs/code are changed: `docs(trash): spike recovery semantics`

## Steps

### Step 1: Inventory current deletion behavior

Trace delete paths for notes, tabs, hashtags, filesystem files, and any existing `.trash` behavior. Separate soft-delete, hard-delete, and file move behavior.

**Verify**: design note lists current delete call sites and storage-mode differences.

### Step 2: Define trash domain semantics

Decide what “move to trash” means for a note: fields like `deletedAt`, file moves, tab closure, hashtag/index behavior, search visibility, templates, quick notes, and read-it-later notes. Define restore and permanent-delete behavior.

**Verify**: design note includes a state table for active, trashed, restored, and purged notes.

### Step 3: Define storage-mode implementation strategy

For Dexie and SQLite, decide whether to add `deletedAt` or a separate trash table. For filesystem mode, decide whether to move files into `.trash`, preserve metadata, and prevent path traversal/symlink issues using plan 001’s helper. Include migration and rollback considerations.

**Verify**: design note covers Dexie, SQLite, and filesystem mode separately.

### Step 4: Define UX and safety boundaries

Specify the UI affordances: delete confirmation or undo toast, Trash view, restore button, empty trash, permanent delete confirmation, keyboard shortcuts, and accessibility copy. Keep design consistent with `DESIGN.md`: calm, token-based colors, no decorative danger styling.

**Verify**: design note includes the first shippable slice and deferred items.

### Step 5: Optional prototype only for uncertainty

If schema or filesystem behavior is uncertain, build a minimal prototype/test in a disposable path. Do not ship partial trash UI as part of this spike unless explicitly requested.

**Verify**: `npm run typecheck` and targeted tests if code changed.

## Test plan

The follow-up implementation plan should require repository tests for soft delete, restore, purge, search/list exclusion, filesystem move failures, and migration. This spike is done when those tests are specified and scoped.

## Done criteria

- [ ] Trash semantics are defined for Dexie, SQLite, and filesystem mode.
- [ ] Restore/purge/empty-trash behavior is specified.
- [ ] Interaction with workspace path confinement from plan 001 is documented.
- [ ] A follow-up implementation plan can be written from the design without new discovery.

## STOP conditions

- Plan 001 has not landed and the spike needs to rely on final path authorization code.
- Existing delete behavior is already partially implemented in a way that conflicts with the proposed semantics.
- The design requires a database migration; flag it for explicit approval before implementation.

## Maintenance notes

Trash is a trust feature, not just a list screen. Reviewers should focus on data-loss edge cases, multi-storage consistency, and clear permanent-delete boundaries.
