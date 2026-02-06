# Specification: Quick Note Dedicated Window

## Overview
Refactor the "Quick Note" feature to open in a dedicated, lightweight, always-on-top window instead of reusing the main application window. This provides a true "quick entry" experience without the distraction of the full app interface.

## Functional Requirements

### 1. Window Management
- **Dedicated Window:** Triggering "Quick Note" (via shortcut `Cmd+Alt+N` or Tray) should create/show a *secondary* `BrowserWindow`.
- **Always on Top:** This window must have `alwaysOnTop: true`.
- **Size & Position:** Should be smaller than the main window (e.g., 600x400) and centered or positioned optimally.
- **Frameless (Optional):** Consider a minimal frame or title bar for a cleaner look.

### 2. Note Logic
- **Content:** The window should display an editor for a new or latest "Quick Note".
- **Lifecycle:** 
    - Closing the Quick Note window should *not* quit the app.
    - It should probably just close/destroy the window, saving the note.
- **Isolation:** It needs to load the React app but perhaps in a specific route (e.g., `/quicknote`) to show only the editor and minimal UI (no sidebar, no tabs).

### 3. IPC & events
- **Trigger:** The existing `quicknote:open` event logic needs to be redirected to open this new window instead of focusing the main one.

## Acceptance Criteria
- [ ] `Cmd+Alt+N` opens a new, separate window.
- [ ] The new window stays on top of other applications.
- [ ] The new window displays only the editor (minimal UI).
- [ ] Closing the window saves the note and keeps the main app running.
