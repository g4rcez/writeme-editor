# Specification: Finalize Core Features (Excalidraw & Recent Notes)

## Overview
This track aims to finalize two key features that are partially implemented but not yet fully integrated into the user experience:
1. **Excalidraw Integration:** Enable the Excalidraw component within editor blocks and ensure diagram data is correctly persisted.
2. **Recent Notes Quick Navigation:** Mount the existing `RecentNotesDialog` in the application and ensure it is accessible via the command palette and shortcuts.

## Functional Requirements

### 1. Excalidraw Integration
- **Enable Component:** Uncomment the `<Excalidraw />` component in `src/app/elements/excalidraw.tsx`.
- **Data Persistence:** Ensure that changes made in the Excalidraw whiteboard are correctly serialized to JSON and passed back to the Tiptap editor via the `onChange` prop.
- **Rendering:** The Excalidraw block should occupy a fixed or responsive height (e.g., 500px) and support theme switching (light/dark) if applicable.
- **Initialization:** Correctly restore elements from the stored `code` string in the block attributes.

### 2. Recent Notes Quick Navigation
- **App Integration:** Mount `<RecentNotesDialog />` in `src/app/app.tsx`.
- **Visibility Control:** Ensure the dialog visibility is controlled by the `recentNotesDialog` state in the global store.
- **Access:** 
    - Verify the `mod+e` (Cmd+E / Ctrl+E) shortcut triggers the dialog.
    - Ensure a "Recent Notes" command is available in the `Commander` (Command Palette).
- **Navigation:** Selecting a note from the dialog must close the dialog and navigate to the selected note.

## Acceptance Criteria
- [ ] Excalidraw whiteboard is interactive within the editor.
- [ ] Changes to Excalidraw diagrams are saved and survive a page reload.
- [ ] `RecentNotesDialog` opens when pressing `Cmd/Ctrl + E`.
- [ ] `RecentNotesDialog` lists notes correctly and allows switching between them.
- [ ] `RecentNotesDialog` lists notes correctly and allows switching between them.
- [ ] Command Palette includes an entry to open Recent Notes.
