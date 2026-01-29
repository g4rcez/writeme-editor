# Implementation Plan - Recent Notes Dialog

## Phase 1: Data Access Layer [checkpoint: a8e08cc]
- [x] Task: Create a repository method to fetch notes sorted by `updatedAt`.
    - [x] Sub-task: Write tests for `getRecentNotes` in `src/store/repositories/dexie/notes.repository.ts`.
    - [x] Sub-task: Implement `getRecentNotes` in `src/store/repositories/dexie/notes.repository.ts`.
- [x] Task: Expose recent notes in the global store.
    - [x] Sub-task: Write tests for `useRecentNotes` selector/hook in `src/store/global.store.ts`.
    - [x] Sub-task: Implement `useRecentNotes` selector/hook.
- [x] Task: Conductor - User Manual Verification 'Data Access Layer' (Protocol in workflow.md)

## Phase 2: UI Components [checkpoint: 481f195]
- [x] Task: Create `RecentNotesDialog` component.
    - [x] Sub-task: Create component shell with open/close state.
    - [x] Sub-task: Implement the list view with Title, Path, and Timestamp.
    - [x] Sub-task: Implement the "Simplified Path" formatting utility with tests.
- [x] Task: Implement Search & Filter Logic.
    - [x] Sub-task: Write tests for filtering logic (by title and path).
    - [x] Sub-task: Add search input and connect to list filtering.
- [x] Task: Implement Navigation & Selection.
    - [x] Sub-task: Add keyboard navigation (ArrowUp/ArrowDown).
    - [x] Sub-task: Handle 'Enter' and Click events to open the note.
- [x] Task: Conductor - User Manual Verification 'UI Components' (Protocol in workflow.md)

## Phase 3: Integration
- [ ] Task: Register "Open Recent" command.
    - [ ] Sub-task: Add `OPEN_RECENT` command to `src/app/commands/commands.ts`.
    - [ ] Sub-task: Bind the command to the `RecentNotesDialog` visibility.
- [ ] Task: Register Keyboard Shortcuts.
    - [ ] Sub-task: Bind `Cmd+E` (and `Ctrl+E`) to trigger the `OPEN_RECENT` command.
- [ ] Task: Conductor - User Manual Verification 'Integration' (Protocol in workflow.md)