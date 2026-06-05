# Feature: Now, add the command CTRL/CMD+T to show a commander only with the opened tabs

## Problem

Users can open the general commander, but there is no focused keyboard command for switching among only the tabs that are already open. This makes keyboard-driven tab switching harder when many notes exist.

## Solution

- Add an opened-tabs commander mode to the existing commander type enum.
- Build a flat command list from `state.tabs`, sorted by tab order and labeled from the matching note title.
- Add a `Ctrl/Cmd+T` shortcut that opens the commander in the opened-tabs mode.
- Selecting an opened-tab command closes the commander, saves the current cursor, selects the target note in the store, and navigates to that note.
- Reuse the existing `CommandPalette`, shortcut registration, and commander store state.

## Edge Cases

- No opened tabs should show an empty focused commander instead of all commands.
- Tabs without a matching loaded note should still appear as `Untitled` and navigate by `tab.noteId`.
- Existing all-commander and notes-only commander modes should keep working.
- The shortcut must be non-hidden so `useShortcuts()` registers it.
- Browser builds may normally reserve `Ctrl/Cmd+T`, but the app shortcut registry prevents default behavior when focused.

## Task Breakdown

- [x] Confirm commander filtering, shortcut registration, and tab title lookup patterns.
- [x] Add an opened-tabs commander type.
- [x] Build opened-tab command items from sorted open tabs.
- [x] Register `Ctrl/Cmd+T` to open the opened-tabs commander.
- [x] Add/update regression tests for the shortcut list.
- [x] Run targeted tests and diagnostics.
- [x] Perform self-review for simplicity, scope, and LESSONS.md compliance.

## Definition of Done

- [x] `Ctrl/Cmd+T` opens the commander in opened-tabs mode.
- [x] The opened-tabs commander only includes open tabs.
- [x] Selecting an opened tab navigates to the tab's note and closes the commander.
- [x] Existing commander modes still work.
- [x] Targeted verification complete: `npm test -- src/app/elements/shortcut-items.test.tsx` passed (3 tests).
- [x] LSP diagnostics pass for changed source/test files.
- [x] Type checking attempted. `npm exec -- tsc --noEmit --ignoreDeprecations 6.0` reaches existing unrelated project errors outside the opened-tabs commander changes.
