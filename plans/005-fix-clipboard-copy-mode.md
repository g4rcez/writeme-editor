# Plan 005: Make clipboard copy mode single-instance and correctly stopped

> **Executor instructions**: Follow this plan step by step. Run every verification command. If a STOP condition occurs, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 67641c2..HEAD -- src/app/commands/clipboard-listener.command.ts src/ipc/copy-event.ts src/app/editor.tsx src/app/commands`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `67641c2`, 2026-06-14

## Why this matters

The `>>copy` command polls the clipboard and inserts changes into the editor. Re-running it can leak intervals because only the latest interval handle is retained. `>>endcopy` also dispatches the started event instead of the finished event, so editor-side monitoring may remain active after the user stopped copy mode.

## Current state

- `src/ipc/copy-event.ts:1-3` defines `COPY_EVENT_STARTED`, `COPY_EVENT_DISPATCHED`, and `COPY_EVENT_FINISHED`.
- `src/app/editor.tsx:39-54` sets `monitoring.current = true` on started and `false` on finished.
- `src/app/commands/clipboard-listener.command.ts:5` stores a single module-level `interval`.
- `src/app/commands/clipboard-listener.command.ts:12-18` assigns a new interval on every `>>copy`.
- `src/app/commands/clipboard-listener.command.ts:27-29` dispatches `COPY_EVENT_STARTED` and clears only the latest interval on `>>endcopy`.

## Commands you will need

| Purpose         | Command                            | Expected on success |
| --------------- | ---------------------------------- | ------------------- |
| Typecheck       | `npm run typecheck`                | exit 0              |
| Tests           | `npm run test -- src/app/commands` | targeted tests pass |
| Full unit suite | `npm run test`                     | all unit tests pass |

## Scope

**In scope**:

- `src/app/commands/clipboard-listener.command.ts`
- New tests for clipboard listener commands
- Minimal test support/mocks for `controller.clipboard`

**Out of scope**:

- Redesigning all replacer commands
- Changing Tiptap editor insertion behavior
- Changing clipboard permissions or Electron clipboard APIs

## Git workflow

- Branch: `advisor/005-fix-clipboard-copy-mode`
- Commit message: `fix(commands): stop clipboard copy mode correctly`

## Steps

### Step 1: Add characterization tests

Create tests for start and stop behavior. Use fake timers and a mocked `controller.clipboard()` if possible. Assert that start dispatches `COPY_EVENT_STARTED`, stop dispatches `COPY_EVENT_FINISHED`, and repeated start does not leave multiple active intervals.

**Verify**: tests fail against the current implementation for the finished-event/repeated-start behavior.

### Step 2: Make start idempotent

Before creating a new interval, either no-op when one is already active or clear the existing interval. Prefer one active watcher at a time. Reset `clipboardState` if needed so first changed clipboard content after restart is handled predictably.

**Verify**: targeted tests pass for repeated `>>copy`.

### Step 3: Stop with the correct event and clear state

Import `COPY_EVENT_FINISHED`, dispatch it in `ClipboardCloseListenerCommand.replace()`, clear the interval, and set `interval = null`. Make stopping when inactive harmless.

**Verify**: targeted tests pass.

### Step 4: Run validation

Run typecheck and the full unit suite.

**Verify**: `npm run typecheck` and `npm run test` pass or unrelated failures are documented.

## Test plan

- New tests under `src/app/commands/` for:
  - start event dispatch
  - stop event dispatch
  - repeated starts do not create multiple active polling loops
  - stop clears and nulls interval behavior

## Done criteria

- [ ] `>>endcopy` dispatches `COPY_EVENT_FINISHED`.
- [ ] At most one clipboard polling interval can be active through this module.
- [ ] Stopping copy mode is safe when inactive.
- [ ] `npm run typecheck` and relevant tests pass.

## STOP conditions

- The command test harness cannot safely mock timers/window events without broad test setup changes.
- Fixing this requires changing editor insertion semantics in `src/app/editor.tsx`.

## Maintenance notes

Future clipboard features should treat copy monitoring as a small state machine: inactive, active, stopping. Review interval lifecycle carefully in code review.
