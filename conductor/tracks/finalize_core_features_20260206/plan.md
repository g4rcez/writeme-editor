# Implementation Plan: Finalize Core Features (Excalidraw & Recent Notes)

## Phase 1: Excalidraw Finalization
- [x] Task: Enable Excalidraw Component [00d8306]
    - [x] Sub-task: Write unit tests for `ExcalidrawCode` component to verify initialization and change handling.
    - [x] Sub-task: Uncomment `<Excalidraw />` in `src/app/elements/excalidraw.tsx`.
    - [x] Sub-task: Implement robust `onChange` handling to serialize and save diagram state.
    - [ ] Sub-task: Uncomment `<Excalidraw />` in `src/app/elements/excalidraw.tsx`.
    - [ ] Sub-task: Implement robust `onChange` handling to serialize and save diagram state.
- [x] Task: Conductor - User Manual Verification 'Excalidraw Finalization' (Protocol in workflow.md) [checkpoint: 4f3ee36]

## Phase 2: Background App & Global Shortcuts
- [x] Task: Verify and Fix Background Implementation [256b709]
    - [x] Sub-task: Verify `src/main.ts` implementation for Tray, Hide-on-Close, and Global Shortcuts.
    - [x] Sub-task: Write integration/E2E tests (using Playwright/Electron) to verify:
        - App hides on close.
        - Tray icon exists.
        - Global shortcut triggers `quicknote:open` event.
    - [x] Sub-task: Fix any issues found during verification.
- [ ] Task: Conductor - User Manual Verification 'Background App' (Protocol in workflow.md)
    - [ ] Sub-task: Write integration/E2E tests (using Playwright/Electron) to verify:
        - App hides on close.
        - Tray icon exists.
        - Global shortcut triggers `quicknote:open` event.
- [x] Task: Conductor - User Manual Verification 'Background App' (Protocol in workflow.md) [checkpoint: acf9c7f]

## Phase 3: Recent Notes Integration
- [x] Task: Mount RecentNotesDialog [2bc0623]
    - [x] Sub-task: Update `src/app/app.tsx` to include `<RecentNotesDialog />`.
- [x] Task: Verify and Enhance Access [d3a8916]
    - [x] Sub-task: Verify `recentNotesDialog` toggle works via keyboard shortcut (`src/app/elements/shortcut-items.tsx`).
    - [x] Sub-task: Add "Open Recent Notes" command to `src/app/commander.tsx`.
- [x] Task: Final Verification [d3a8916]
    - [x] Sub-task: Write/Update integration tests for `RecentNotesDialog` to ensure it interacts correctly with the store and navigation.
- [x] Task: Conductor - User Manual Verification 'Recent Notes Integration' (Protocol in workflow.md) [checkpoint: 700a78b]
