# Tiptap position scroll restoration

## Completed

- Added `editor-scroll-anchor` helpers to capture the visible Tiptap/ProseMirror position at the top of `.writeme-layout-scroll`.
- Stored the serialized `editor.utils.createMappablePosition(...)` value in `CursorPositionStore` with the position's viewport offset.
- Restored tabs by aligning the saved Tiptap position back to the same offset, with raw `scrollTop` as a fallback.
- Passed the active Tiptap editor into all editor-position save paths so scroll anchors are captured during scroll, autosave, unmount, unload, and tab switches.

## Validation

- `lsp_diagnostics` on touched TypeScript/TSX files: passed with zero errors.
- `npm test -- src/lib/editor-scroll-anchor.test.ts src/lib/scroll-utils.test.ts src/lib/tab-scroll.test.ts`: passed, 8 tests.
- `npm run typecheck`: attempted; still fails due existing unrelated errors in settings components, markdown extension typing, notes/read-it-later/tag table typing, and design tokens.

## Self-review

The change keeps raw scroll restoration as compatibility fallback but now uses the editor document itself as the primary anchor. This should avoid pixel-offset drift from dynamic Tiptap layout while leaving existing cursor selection restoration intact.
