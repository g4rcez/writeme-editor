# Feature: Filetree sidebar create actions

## Problem

The Explorer header shows two top action icons, but clicking them does nothing. Users expect them to create items in the current filetree root.

## Solution

- Wire the first Explorer header icon to start inline creation of a markdown file in the workspace root.
- Wire the second Explorer header icon to start inline creation of a folder in the workspace root.
- Reuse the existing `TreeView` pending-create flow so naming, Enter/Escape, refresh, and file/folder creation behavior stays consistent with context-menu creation.

## Edge Cases

- Creating in an empty workspace should still show the inline name input.
- Repeated clicks on the same action should start a new create request even after canceling.
- Existing context-menu create actions should keep working.

## Task Breakdown

- [x] Locate Explorer header buttons and existing TreeView create flow.
- [x] Add a controlled create request path from Explorer to TreeView.
- [x] Wire header actions in order: file, folder.
- [x] Add regression coverage for root header-style create requests and empty trees.
- [x] Run targeted tests and diagnostics.
- [x] Perform self-review for simplicity, scope, and styling compliance.

## Definition of Done

- [x] The first top icon starts creating a file at the filetree root.
- [x] The second top icon starts creating a folder at the filetree root.
- [x] Empty filetrees support the same top-icon create flow.
- [x] Context-menu create behavior remains unchanged.
- [x] Targeted verification complete: `npm test -- src/app/components/tree-view.test.tsx` passed (3 tests).
- [x] LSP diagnostics pass for changed source/test files.
- [x] Type checking attempted. `npm run typecheck` is blocked by the existing TypeScript 6 `baseUrl` deprecation; `npm exec -- tsc --noEmit --ignoreDeprecations 6.0` reaches existing unrelated errors outside the filetree changes.
