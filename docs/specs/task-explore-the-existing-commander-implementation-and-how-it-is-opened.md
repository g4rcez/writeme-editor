# Feature: Task: Explore the existing Commander implementation and how it is opened/filtered

## Problem

The codebase needs scouting context for adding Ctrl/Cmd+T to open a Commander view filtered to currently opened editor tabs.

## Solution

Map the existing Commander, global store tab state, shortcut registration, and tab navigation patterns. Write findings to `context.md` for a follow-up implementation agent.

## Edge Cases

- Existing Commander mode handling may reset to `All` when no type is supplied.
- Hidden shortcuts are not registered by the app shortcut hook.
- Ctrl/Cmd+T conflicts with browser new-tab behavior and must be intentionally prevented if implemented.
- Opened tabs may need note-title lookup from `state.notes`.

## Task Breakdown

- [x] Locate Commander entry points and filtering.
- [x] Locate global tab state and tab UI patterns.
- [x] Locate shortcut registration and key normalization.
- [x] Write scouting findings to `context.md`.

## Definition of Done

- [x] Findings written to `context.md`
- [x] Relevant files and line ranges documented
- [x] Minimal implementation recommendation documented
