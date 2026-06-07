# Fix editor tab scroll restoration

## Goal

Returning to an opened note tab should reliably restore the editor scroll position that was saved before leaving that tab.

## Suspected issue

The current implementation saves offsets, but restoration may run before the editor page has enough rendered height, so the scroll container clamps the requested position back to the top. Follow-up testing showed the scroll must be controlled on the `.writeme-layout-scroll` element directly.

## Plan

- Inspect the current scroll save/restore implementation and the scroll container lifecycle.
- Make restoration retry after layout/content rendering instead of applying the offset only once.
- Target the `.writeme-layout-scroll` element for save/restore/listener behavior.
- Keep changes scoped to editor/tab scroll behavior.
- Add focused tests for any pure helper introduced.
- Run diagnostics and targeted tests.

## Definition of Done

- [x] A saved non-zero scroll position is reapplied after returning to a note tab.
- [x] Restoration waits for the scroll container to have enough height instead of silently clamping to top.
- [x] Save/restore/listener behavior controls `.writeme-layout-scroll` directly.
- [x] Existing cursor restoration remains intact.
- [x] Validation commands are run and documented.
