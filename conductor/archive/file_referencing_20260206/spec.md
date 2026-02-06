# Specification: File Referencing with @ Mention Syntax

## Overview
Implement a feature allowing users to reference files and notes using the `@` character, similar to LLM CLI tools. This feature enhances cross-referencing and navigation within the editor.

## Functional Requirements

### 1. Syntax & Parsing
- **Trigger:** Typing `@` should trigger a suggestion menu.
- **Storage Format:** References should be stored in Markdown as `@"path/to/file.ext"`.
- **Project Notes:** References to existing notes (in the database/project) should be stored as `@"Note Title"`.

### 2. Autocompletion
- **Scope:** 
  - List all notes in the current project (from Dexie DB).
  - (Optional/Future) List files in the current workspace/directory if applicable.
- **Filtering:** Filtering should match against note titles or file paths.

### 3. Rendering (Display)
- **Editor View:** 
  - The raw `@"..."` syntax should be hidden and replaced by a "chip" or styled text element.
  - **Label:**
    - For Project Notes: Display the Note Title.
    - For External Files: Display the basename of the file.
- **Markdown Export:** Ensure the output remains valid `@"..."` syntax.

### 4. Interaction
- **Navigation:** Clicking the reference chip should:
  - Open the referenced note if it exists in the project.
  - (Optional) Open the file if it exists on disk.
- **Hover:** Show the full path/title on hover.

## Technical Considerations
- **Tiptap Extension:** Implement a custom Tiptap extension using `Mention` as a base or similar logic.
- **Node View:** Use a React Node View for rendering the reference chip.

## Acceptance Criteria
- [ ] Typing `@` opens a suggestion list of project notes.
- [ ] Selecting a note inserts `@"Note Title"` (or `@"Note ID"`? Title is preferred for readability, ID for robustness. Let's stick to user request: `@"FILENAME"`).
- [ ] In the editor, `@"My Note"` is rendered as a chip labeled "My Note".
- [ ] In the editor, `@"path/to/image.png"` is rendered as a chip labeled "image.png".
- [ ] Clicking the chip navigates to the note.
