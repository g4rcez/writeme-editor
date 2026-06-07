# Refactor editor scroll memory hook

## Completed

- Refactored `useEditorScrollMemory` into a null-safe hook that loads per-note cursor/scroll memory once per editor/note pair, restores selection without Tiptap's `setTextSelection` scroll side effect, restores `y = 0`, records scroll snapshots, and saves the latest cursor/scroll snapshot on cleanup.
- Added focused Vitest coverage for null editors, mount restoration, cleanup saving, and async-load-after-unmount behavior.
- Updated `CursorPositionStore` tests and made LRU eviction use the stored rows directly instead of requiring an unconfigured IndexedDB `updatedAt` index.
- Removed the unused legacy scroll-saver helpers/tests and disconnected the unused `saveTabScroll` dispatcher wiring.

## Validation

- `lsp_diagnostics` on touched TS/TSX files: passed with zero diagnostics.
- `npm test -- src/app/hooks/use-editor-scroll-memory.test.ts src/store/cursor-position.store.test.ts`: passed, 7 tests.
- `npm test`: passed, 55 files / 493 tests.
- `npx prettier --check ...`: passed for touched source/docs files.
- `npm run typecheck`: attempted; still fails with 19 pre-existing unrelated errors in settings, markdown extension, notes/read-it-later/tag table typing, and sidebar imports. Filtered output showed no errors for touched scroll memory/cursor/global files.

## Self-review

The hook now has a single setup/cleanup lifecycle keyed by `id` and `editor`, avoids effect churn from selection changes, and guards async restore after unmount with `AbortController`. The solution intentionally avoids restoring via Tiptap command chains because they can trigger unwanted scroll behavior in this editor. The remaining tab `scrollY` data shape was left in place to avoid risky schema cleanup outside this refactor.
