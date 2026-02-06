# Implementation Plan: Enable Window Controls for Quick Note

## Phase 1: Window Configuration
- [x] Task: Update Quick Note Window Options
    - [x] Sub-task: Modify `src/main-process/quicknote-window.ts`.
    - [x] Sub-task: Change `frame: false` to `frame: true` (or remove it).
    - [x] Sub-task: Ensure `titleBarStyle` is appropriate (e.g., 'hidden' on Mac if we want a custom look, or default for standard). Let's stick to default `frame: true` first.
- [ ] Task: Conductor - User Manual Verification 'Window Controls' (Protocol in workflow.md)
