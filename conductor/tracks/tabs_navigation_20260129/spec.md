# Specification: Tab-based File Navigation

## Overview
Implement a tab bar interface positioned directly below the main navigation bar to manage open files. This feature mimics the functionality of IDEs like VS Code, allowing users to easily switch between multiple active notes, identify unsaved changes, and manage their workspace layout.

## Functional Requirements

### UI/UX
- **Positioning:** The tab bar must be located immediately below the main application navbar and fixed at the top of the editor pane.
- **Tab Elements:**
  - Display the file name.
  - Include a "Close" button (x icon) for each tab.
  - Show a visual indicator (e.g., a dot) for files with unsaved changes ("dirty" state).
  - Support drag-and-drop to reorder tabs.
  - Support middle-click on a tab to close it.
  - Show a tooltip with the full file path when hovering over a tab.

### Interactions
- **Switching:** Clicking a tab makes it active and renders the corresponding note in the editor.
- **Opening:** Opening a file from the file explorer or command palette adds it as a new tab (if not already open) and focuses it.
- **Closing:**
  - Closing a tab removes it from the bar.
  - If the closed tab was active, focus should switch to the adjacent tab.
  - Closing the last open tab displays a "No file open" placeholder or welcome screen.

### Persistence
- **State Storage:** The list of open tabs (id, name, order, project) must be persisted in IndexedDB.
- **Session Restoration:** Upon relaunching the application, the exact state of the tabs (files, order, active tab) must be restored.
- **Project Context:** Tab state should be associated with the current project.

## Non-Functional Requirements
- **Performance:** Tab switching should be instantaneous.
- **Styling:** The design must match the existing application aesthetic (Tailwind CSS).
- **Responsiveness:** The tab bar should handle overflow gracefully (horizontal scroll).

## Out of Scope
- Split-pane editing.
- Tab grouping.
