# Implementation Plan: Quick Note Dedicated Window

## Phase 1: Main Process Window Logic
- [ ] Task: Create Quick Note Window Manager
    - [ ] Sub-task: Update `src/main-process/window-lifecycle.ts` (or create `quicknote-window.ts`) to handle the creation of the secondary window.
    - [ ] Sub-task: Implement `createQuickNoteWindow()` with `alwaysOnTop: true`.
    - [ ] Sub-task: Ensure it loads a specific URL/route (e.g., `/#/quicknote`).
- [ ] Task: Update Trigger Logic
    - [ ] Sub-task: Modify `globalShortcut` handler in `src/main.ts` to call the new creation logic.
    - [ ] Sub-task: Modify Tray "Quick Note" click handler.
- [ ] Task: Conductor - User Manual Verification 'Window Creation' (Protocol in workflow.md)

## Phase 2: Renderer & UI
- [ ] Task: Create Quick Note Route
    - [ ] Sub-task: Add `/quicknote` route in `src/app/router.tsx` (or `brouther` config).
    - [ ] Sub-task: Create `QuickNoteLayout` or page that renders *only* the `Editor` (no Sidebar, no Navbar).
- [ ] Task: Handle Data/State
    - [ ] Sub-task: Ensure the Quick Note window can access the DB (Dexie) and load the correct note.
    - [ ] Sub-task: Verify saving works from the secondary window.
- [ ] Task: Final Verification
    - [ ] Sub-task: Verify `alwaysOnTop` behavior.
    - [ ] Sub-task: Verify independent lifecycle (main window closed, quick note open).
- [ ] Task: Conductor - User Manual Verification 'Quick Note UX' (Protocol in workflow.md)
