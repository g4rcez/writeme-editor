# Feature: Remove outer app scroll while editing

## Problem

When a note editor is open, the application can expose an extra document/app-level vertical scroll in addition to the editor pane scroll. This creates competing scroll regions and makes the writing surface feel less stable.

## Solution

- Lock the document, body, and React root to the viewport with hidden overflow.
- Add `min-h-0` and overflow containment through the main app flex hierarchy so nested panels shrink correctly.
- Keep `#main-scroll-container` as the single vertical scroll owner for editor content, cursor restoration, table-of-contents navigation, and search result scrolling.

## Edge Cases

- Terminal panel resizing should remain contained inside the app shell.
- Print styles should still opt back into auto height and visible overflow.
- Non-editor routes should continue to use the main content scroll container.
- Floating quicknote/mathnote windows should remain viewport-contained.

## Task Breakdown

- [x] Locate the app/editor scroll hierarchy.
- [x] Lock root document overflow outside print mode.
- [x] Add flex height containment to the main layout and resizable panels.
- [x] Run diagnostics/type checks.
- [x] Document manual verification results.
- [x] Perform self-review for simplicity and scope.

## Verification

- [x] Manual verification documented in `docs/tasks/remove-outer-app-scroll.md`.
- [x] Scroll containment file check passed.
- [x] Changed-file TypeScript diagnostics passed or returned no changed-file errors.

## Definition of Done

- [x] Document/body/root no longer provide a competing vertical scroll while the editor is open.
- [x] The editor pane remains scrollable through `#main-scroll-container`.
- [x] Resizable terminal panel remains contained by flex `min-h-0` boundaries.
- [x] Scroll containment file check passed for `index.html`, `src/app/styles/writeme.css`, and `src/app/layouts/main.layout.tsx`.
- [x] LSP diagnostics passed for `src/app/layouts/main.layout.tsx`; CSS LSP was unavailable. `npm run typecheck` remains blocked by the existing TypeScript 6 `baseUrl` deprecation, and a changed-file filter after `tsc --ignoreDeprecations 6.0` returned no errors.
- [x] Browser build transformed and emitted assets; final validation is blocked by existing unrelated project type errors in design tokens/read-it-later code.
- [x] Self-review complete: the fix is layout-only, keeps print overflow visible, and preserves the existing editor scroll utilities.
