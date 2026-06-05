# Feature: Task: Explore how editor tabs are represented and switched in this writeme-editor codebase.

## Problem

Scout the codebase to identify how editor tabs are represented, displayed, switched, and where Ctrl+Tab / Shift+Ctrl+Tab cycling could be added.

## Solution

Perform read-only code exploration and write findings to `context.md` for the implementing agent.

## Edge Cases

- Do not modify source code.
- Distinguish route-driven active tab UI from store `activeTabId`.
- Identify Electron global shortcuts separately from renderer shortcuts.

## Task Breakdown

- [x] Locate tab UI.
- [x] Locate tab store/entity/repositories.
- [x] Locate route/state switching flow.
- [x] Locate existing shortcuts.
- [x] Write findings to `context.md`.

## Definition of Done

- [x] Findings written to requested context file
- [x] Correctness demonstrated by cited files and line ranges
- [x] A staff engineer would approve this scouting summary
- [x] Documentation updated
