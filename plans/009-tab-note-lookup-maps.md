# Plan 009: Replace tab-derived repeated note scans with lookup maps

> **Executor instructions**: Follow this plan step by step. Run every verification command. If a STOP condition occurs, stop and report. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 67641c2..HEAD -- src/app/components/tabs-bar.tsx src/app/commander.tsx src/lib`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `67641c2`, 2026-06-14

## Why this matters

Tab UI paths currently scan the full notes list once per tab. This is fine for small workspaces but becomes avoidable O(tabs × notes) work on frequent renders. A memoized note-by-id map keeps behavior the same while making lookups constant-time.

## Current state

- `src/app/components/tabs-bar.tsx:95` does `state.notes.find((n: Note) => n.id === tab.noteId)` inside `state.tabs.map(...)`.
- `src/app/commander.tsx:93` does the same inside open-tab command construction.
- `src/app/components/tabs-bar.tsx:58` has another note lookup helper path to inspect for possible reuse.
- Code style: React functional components with hooks; prefer typed helpers and no `any`.

## Commands you will need

| Purpose   | Command             | Expected on success |
| --------- | ------------------- | ------------------- |
| Typecheck | `npm run typecheck` | exit 0              |
| Tests     | `npm run test`      | all unit tests pass |

## Scope

**In scope**:

- `src/app/components/tabs-bar.tsx`
- `src/app/commander.tsx`
- Optional tiny helper under `src/lib/` if reused cleanly

**Out of scope**:

- Changing tab ordering, routing, close behavior, or command palette UX
- Refactoring global store shape
- Broad performance work outside tab-derived note lookups

## Git workflow

- Branch: `advisor/009-tab-note-lookup-maps`
- Commit message: `perf(ui): memoize tab note lookups`

## Steps

### Step 1: Add or reuse a typed note-by-id map

Create a `useMemo` map in each component or a small shared helper if that is simpler. The map should be `Map<Note["id"], Note>` or equivalent. Its dependency must be `state.notes` or the existing notes signature if the component already uses one.

**Verify**: `npm run typecheck` exits 0.

### Step 2: Replace repeated `find` calls in tab-derived loops

Use `noteById.get(tab.noteId)` in `TabsBar` and `Commander`. Preserve the fallback title `Untitled`, `title` attributes, active-tab behavior, sorting, and navigation actions exactly.

**Verify**: `rg "state\.notes\.find" src/app/components/tabs-bar.tsx src/app/commander.tsx` returns no repeated loop lookup; `npm run typecheck` exits 0.

### Step 3: Validate UI behavior

Run unit tests. If running the app is practical, manually open multiple tabs and verify tab titles and command palette open-tab entries still match notes.

**Verify**: `npm run test` passes or unrelated failures are documented.

## Test plan

No new test is required if this is a pure lookup refactor. Add a small helper test only if a shared helper is introduced.

## Done criteria

- [ ] Tab-derived loops use a memoized lookup map instead of scanning notes per tab.
- [ ] Existing fallback and navigation behavior is unchanged.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test` passes or unrelated failures are documented.

## STOP conditions

- The note list mutates in place such that `useMemo([state.notes])` would be stale; report the store behavior instead of guessing.
- The change appears to require global store refactoring.

## Maintenance notes

This is a small performance cleanup. Reviewers should reject broad commander/tab rewrites in this plan.
