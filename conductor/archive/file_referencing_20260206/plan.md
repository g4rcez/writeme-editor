# Implementation Plan: File Referencing with @ Mention Syntax

## Phase 1: Tiptap Extension & Parsing
- [x] Task: Create File Mention Extension
    - [x] Sub-task: Scaffold a new Tiptap extension `FileReference` (likely extending `Mention`).
    - [x] Sub-task: Configure the regex to match `@"..."` pattern.
    - [x] Sub-task: Implement the `renderHTML` and `parseHTML` rules to handle the specific syntax.
- [x] Task: Conductor - User Manual Verification 'Extension Setup' (Protocol in workflow.md)

## Phase 2: Autocompletion & UI
- [x] Task: Implement Suggestion Logic
    - [x] Sub-task: Create a suggestion utility that queries `repositories.notes` (Dexie).
    - [x] Sub-task: Create the `SuggestionList` React component (or reuse existing if available).
    - [x] Sub-task: Connect the extension to the suggestion utility.
- [x] Task: Conductor - User Manual Verification 'Autocompletion' (Protocol in workflow.md)

## Phase 3: Rendering & Interaction
- [x] Task: Implement Node View
    - [x] Sub-task: Create a React Node View for the reference.
    - [x] Sub-task: Implement logic to display Note Title vs. File Basename.
    - [x] Sub-task: Add `onClick` handler to navigate to the note/file.
- [x] Task: Final Verification
    - [x] Sub-task: Verify markdown export preserves `@"..."`.
    - [x] Sub-task: Verify navigation works.
- [x] Task: Conductor - User Manual Verification 'Interaction' (Protocol in workflow.md)
