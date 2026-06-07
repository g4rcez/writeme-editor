# Fix editor tab scroll restoration

## Completed

- Replaced one-shot scroll restoration with `restoreScrollY`, which retries until the scroll container reaches the saved offset.
- Retargeted scroll save/restore/listener behavior to the `.writeme-layout-scroll` element, with the old id as a fallback.
- Kept cursor selection restoration intact and only retried the scroll offset.
- Added tests for class-based layout scroll selection, clamping restore offsets, and retrying once layout becomes scrollable.

## Validation

- `lsp_diagnostics` on touched TypeScript/TSX files: passed with zero errors.
- `npm test -- src/lib/scroll-utils.test.ts src/lib/tab-scroll.test.ts`: passed, 7 tests.
- `npm run typecheck`: attempted; still fails due existing unrelated errors in settings components, markdown extension typing, notes/read-it-later/tag table typing, and design tokens.

## Self-review

The fix is scoped to the scroll container and restore timing. It avoids changing tab routing or editor state and now controls the same `.writeme-layout-scroll` element that owns the editor scroll.
