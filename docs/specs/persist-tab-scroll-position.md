# Persist editor tab scroll position

## Goal

When a user switches away from an opened file tab and later returns to it, the editor should restore that tab's previous vertical scroll position.

## Plan

- Inspect current editor tab state, route selection, and scroll container ownership.
- Store per-tab scroll positions using the existing opened-file/tab state pattern.
- Capture scroll offsets before tab switches/closures and while scrolling the active editor.
- Restore the saved offset after the editor content for a tab is rendered.
- Add focused regression coverage for the state/helper behavior when practical.
- Run lint/typecheck or the smallest relevant validation.

## Definition of Done

- [x] Opened file tabs remember their scroll position across tab switches.
- [x] Returning to a tab restores the saved scroll position after content loads.
- [x] Closing/removing tabs does not leave stale active-tab behavior.
- [x] Existing tab behavior remains unchanged aside from scroll restoration.
- [x] Validation commands are run and documented.
