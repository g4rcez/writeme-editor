# Implementation Plan: Quick Note Dedicated Window

## Phase 1: Main Process Window Logic
- [x] Task: Create Quick Note Window Manager
    - [x] Sub-task: Update `src/main-process/window-lifecycle.ts` (or create `quicknote-window.ts`) to handle the creation of the secondary window.
    - [x] Sub-task: Implement `createQuickNoteWindow()` with `alwaysOnTop: true`.
    - [x] Sub-task: Ensure it loads a specific URL/route (e.g., `/#/quicknote`).
- [x] Task: Update Trigger Logic
    - [x] Sub-task: Modify `globalShortcut` handler in `src/main.ts` to call the new creation logic.
    - [x] Sub-task: Modify Tray "Quick Note" click handler.
- [x] Task: Conductor - User Manual Verification 'Window Creation' (Protocol in workflow.md)

## Phase 2: Renderer & UI
- [x] Task: Create Quick Note Route
    - [x] Sub-task: Add `/quicknote` route in `src/app/router.tsx` (or `brouther` config).
    - [x] Sub-task: Create `QuickNoteLayout` or page that renders *only* the `Editor` (no Sidebar, no Navbar).
- [x] Task: Handle Data/State
    - [x] Sub-task: Ensure the Quick Note window can access the DB (Dexie) and load the correct note.
    - [x] Sub-task: Verify saving works from the secondary window.
- [x] Task: Final Verification
    - [x] Sub-task: Verify `alwaysOnTop` behavior.
    - [x] Sub-task: Verify independent lifecycle (main window closed, quick note open).
    - [x] Sub-task: Add "Quick note" command to `src/app/commander.tsx`.
- [x] Task: Conductor - User Manual Verification 'Quick Note UX' (Protocol in workflow.md)
