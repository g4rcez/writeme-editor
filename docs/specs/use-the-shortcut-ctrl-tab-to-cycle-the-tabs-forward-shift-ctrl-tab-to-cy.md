# Feature: Ctrl+Tab editor tab cycling

## Problem

The editor has multiple open note tabs, but there is no keyboard shortcut to move between them. Users expect `Ctrl+Tab` to activate the next editor tab and `Shift+Ctrl+Tab` to activate the previous editor tab.

## Solution

- Add an app-level renderer keybinding in `RootLayout`, alongside the existing global editor shortcuts.
- Detect the physical Control key with `Tab`; use `Shift` to choose backward cycling.
- Cycle through `state.tabs` in tab order, using the current `/note/:noteId` route as the active source of truth because visible tab activation is route-driven.
- Fall back to `state.activeTabId` if the current route does not identify an open tab.
- Save the current cursor before switching, select the target note through the store, then navigate to the target note route.
- No-op when there are fewer than two tabs or no active tab can be determined.

## Edge Cases

- Browser/PWA builds may reserve `Ctrl+Tab` for browser tab switching, but Electron should receive the in-app shortcut.
- If the current note route is not found in `state.tabs`, fall back to `state.activeTabId` before no-oping.
- Cycling wraps at both ends of the tab list.
- Existing shortcuts like `Ctrl+N`, `Ctrl+F`, and `Ctrl+B` should keep working.
- Shortcut handling must not introduce hook-order TDZ issues; callbacks must be declared before effects that reference them.

## Task Breakdown

- [x] Confirm tab state, routing, and existing keyboard shortcut entry point.
- [x] Add a small tab-cycle helper used by `RootLayout`.
- [x] Wire `Ctrl+Tab` forward and `Shift+Ctrl+Tab` backward.
- [x] Add regression tests for wraparound forward/backward tab cycling.
- [x] Run targeted tests and diagnostics.
- [x] Perform self-review for simplicity, scope, and LESSONS.md compliance.

## Definition of Done

- [x] `Ctrl+Tab` activates the next open editor tab.
- [x] `Shift+Ctrl+Tab` activates the previous open editor tab.
- [x] Cycling wraps forward and backward.
- [x] Shortcut is ignored when fewer than two tabs are open.
- [x] Targeted verification complete: `npm test -- src/lib/tab-cycling.test.ts` passed (4 tests).
- [x] LSP diagnostics pass for changed source/test files.
- [x] Type checking attempted. `npm exec -- tsc --noEmit --ignoreDeprecations 6.0` reaches existing unrelated project errors outside the tab-cycling changes.
