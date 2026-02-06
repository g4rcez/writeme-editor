# Implementation Plan: File Referencing with @ Mention Syntax

## Phase 1: Tiptap Extension & Parsing
- [ ] Task: Create File Mention Extension
    - [ ] Sub-task: Scaffold a new Tiptap extension `FileReference` (likely extending `Mention`).
    - [ ] Sub-task: Configure the regex to match `@"..."` pattern.
    - [ ] Sub-task: Implement the `renderHTML` and `parseHTML` rules to handle the specific syntax.
- [ ] Task: Conductor - User Manual Verification 'Extension Setup' (Protocol in workflow.md)

## Phase 2: Autocompletion & UI
- [ ] Task: Implement Suggestion Logic
    - [ ] Sub-task: Create a suggestion utility that queries `repositories.notes` (Dexie).
    - [ ] Sub-task: Create the `SuggestionList` React component (or reuse existing if available).
    - [ ] Sub-task: Connect the extension to the suggestion utility.
- [ ] Task: Conductor - User Manual Verification 'Autocompletion' (Protocol in workflow.md)

## Phase 3: Rendering & Interaction
- [ ] Task: Implement Node View
    - [ ] Sub-task: Create a React Node View for the reference.
    - [ ] Sub-task: Implement logic to display Note Title vs. File Basename.
    - [ ] Sub-task: Add `onClick` handler to navigate to the note/file.
- [ ] Task: Final Verification
    - [ ] Sub-task: Verify markdown export preserves `@"..."`.
    - [ ] Sub-task: Verify navigation works.
- [ ] Task: Conductor - User Manual Verification 'Interaction' (Protocol in workflow.md)
