# Persist editor tab scroll position

## Completed

- Added `scrollY` to opened tab records and SQLite tab storage.
- Centralized editor position saving so cursor/localStorage restoration and tab scroll persistence stay in sync.
- Saved active editor position while scrolling and before tab clicks, tab closes, tab cycling, unload, autosave, and editor unmount.
- Restored editor scroll from cursor history first, then from the opened tab's saved `scrollY` fallback.
- Added focused unit coverage for tab scroll helper behavior.

## Validation

- `lsp_diagnostics` on touched TypeScript/TSX files: passed with zero errors.
- `npm test -- src/lib/tab-scroll.test.ts`: passed, 4 tests.
- `npm run typecheck`: attempted; failed due pre-existing unrelated errors in settings/markdown/tag page files, not from touched files.

## Self-review

The implementation keeps the scroll behavior local to the existing tab/cursor flow and avoids a broad routing refactor. Persisting `scrollY` on the tab record gives reopened tabs a durable fallback while preserving the existing cursor-position localStorage behavior.
