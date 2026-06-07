# Tiptap position scroll restoration

## Goal

Restore editor tab scroll by saving the visible Tiptap document position, not only the raw layout scroll offset.

## Problem

Raw `scrollTop` restoration still does not restore the expected note viewport. The layout scroll container is `.writeme-layout-scroll`, but dynamic editor layout can make a pixel offset unreliable. Saving the Tiptap position at the top of the viewport gives restoration a content anchor.

## Plan

- Inspect Tiptap position APIs and current save/restore paths.
- Save a scroll anchor containing the visible ProseMirror/Tiptap position and its offset inside `.writeme-layout-scroll`.
- Restore by resolving that document position back to DOM coordinates and adjusting `.writeme-layout-scroll.scrollTop`.
- Keep the raw `scrollTop` fallback for compatibility.
- Add focused tests for pure anchor math/helpers where possible.
- Run targeted diagnostics and tests.

## Definition of Done

- [x] Scroll save captures a Tiptap document position anchor from `.writeme-layout-scroll`.
- [x] Returning to a note restores by aligning the saved Tiptap position anchor.
- [x] Existing cursor selection and raw scroll fallback remain intact.
- [x] Validation is run and documented.
