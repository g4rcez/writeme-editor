# Feature: Refactor editor scroll memory hook

## Problem

The new editor scroll memory behavior lives in `src/app/hooks/use-editor-scroll-memory.ts`, but the hook still needs a production-quality cleanup pass and focused regression coverage. The repository also still contains legacy scroll-saver helpers/tests from the previous tab-scroll/anchor implementation, which increases maintenance cost and can confuse future fixes.

## Solution

Refactor `useEditorScrollMemory` around a small, null-safe effect that restores saved cursor/scroll state once per note/editor pair, records scroll snapshots, and saves the latest snapshot on cleanup. Add focused Vitest coverage for restore, save, null-editor, and async-unmount behavior. Remove unused legacy scroll-saver helpers/tests and disconnect any now-unused store dispatcher/imports.

## Edge Cases

- The Tiptap editor can be `null` while the hook is called from React.
- Saved scroll `y` can be `0` and should still be restored.
- Saved cursor anchors can be invalid, non-finite, or beyond the current document size.
- The async load can resolve after the component unmounts or the note/editor changes.
- The main scroll container may be missing in tests or during unusual layout timing.
- Legacy helpers must not be removed while production code still imports them.

## Task Breakdown

- [x] Inspect current hook, call sites, store contract, and legacy scroll-saver references.
- [x] Refactor `useEditorScrollMemory` with null-safe restore/save lifecycle and minimal helpers.
- [x] Remove unused legacy scroll-saver files/tests and any unused dispatch/import wiring.
- [x] Add focused hook/store tests for the new implementation.
- [x] Run targeted Vitest, LSP diagnostics, lint/type checks where practical.
- [x] Self-review for simplicity, hook ordering, no hacky scroll behavior, and scope control.
- [x] Document implementation results and close the task.

## Definition of Done

- [x] Tests written and passing, or manual verification documented
- [x] Correctness demonstrated
- [x] A staff engineer would approve this
- [x] Documentation updated
