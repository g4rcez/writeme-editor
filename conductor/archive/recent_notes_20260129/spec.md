# Specification: Recent Notes Dialog

## Overview
Implement a "Recent Notes" dialog that allows users to quickly switch between notes they have recently edited. This feature enhances navigation and productivity by providing a centralized view of recent activity.

## User Interactions
- **Access:** 
  - Triggered via a new command in the Command Palette.
  - Triggered via a global keyboard shortcut (e.g., `Cmd+E` on macOS, `Ctrl+E` on Windows/Linux).
- **Navigation:**
  - Users can scroll through the list of recent notes.
  - Users can filter the list in real-time using a search input at the top of the dialog.
  - Selecting a note (via mouse click or `Enter` key) opens that note in the editor.

## Functional Requirements
- **Data Retrieval:**
  - Fetch all notes from the database, sorted by their last modified timestamp (descending).
- **Display Components:**
  - **Note Title:** The primary identifier for the note.
  - **Location/Path:** A simplified, truncated relative path from the project root (e.g., `Work / Projects / ... / Drafts`). The immediate parent folder should be clearly visible.
  - **Timestamp:** The date/time the note was last modified.
- **Filtering:**
  - The search input should filter notes based on matches in the title or the path.
- **UI/UX:**
  - The dialog should appear as a modal or an overlay.
  - Follow the project's minimalist aesthetic.

## Non-Functional Requirements
- **Performance:** Filtering and list rendering should be performant even with a large number of notes.
- **Persistence:** The list updates automatically whenever a note is saved/modified.

## Acceptance Criteria
- [ ] Dialog opens via Command Palette and keyboard shortcut.
- [ ] Notes are displayed in descending order of modification time.
- [ ] Search input correctly filters the list by title and path.
- [ ] Selecting a note closes the dialog and opens the note.
- [ ] Paths are displayed in the specified "simplified/truncated" format.

## Out of Scope
- Pinning notes to the top of the recent list.
- Deleting notes directly from the dialog.