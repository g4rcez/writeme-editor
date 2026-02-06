# Implementation Plan: Finalize Core Features (Excalidraw & Recent Notes)

## Phase 1: Excalidraw Finalization
- [ ] Task: Enable Excalidraw Component
    - [ ] Sub-task: Write unit tests for `ExcalidrawCode` component to verify initialization and change handling.
    - [ ] Sub-task: Uncomment `<Excalidraw />` in `src/app/elements/excalidraw.tsx`.
    - [ ] Sub-task: Implement robust `onChange` handling to serialize and save diagram state.
- [ ] Task: Conductor - User Manual Verification 'Excalidraw Finalization' (Protocol in workflow.md)

## Phase 2: Recent Notes Integration
- [ ] Task: Mount RecentNotesDialog
    - [ ] Sub-task: Update `src/app/app.tsx` to include `<RecentNotesDialog />`.
- [ ] Task: Verify and Enhance Access
    - [ ] Sub-task: Verify `recentNotesDialog` toggle works via keyboard shortcut (`src/app/elements/shortcut-items.tsx`).
    - [ ] Sub-task: Add "Open Recent Notes" command to `src/app/commander.tsx`.
- [ ] Task: Final Verification
    - [ ] Sub-task: Write/Update integration tests for `RecentNotesDialog` to ensure it interacts correctly with the store and navigation.
- [ ] Task: Conductor - User Manual Verification 'Recent Notes Integration' (Protocol in workflow.md)
