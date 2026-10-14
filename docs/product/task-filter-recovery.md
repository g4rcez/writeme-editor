# Task board filter recovery

## Discovery

On a populated board, an unmatched search hides all cards but leaves the columns saying **Add a task**. The existing **Show all columns** recovery appears only when every column is hidden. People cannot tell whether their tasks disappeared or whether the current search hides them.

The board also retains All/Active/Backlog filtering logic and tests, but the corresponding controls are absent from the toolbar. Restore those controls alongside the recovery action.

The first browser reproduction found a preceding initialization bug: a new board's local Markdown state starts empty, so its synchronization effect removes the four default columns. Initialize that state from the persisted note content.

## Interaction

- Search, task scope, and Hide empty columns remain local view preferences.
- **Clear filters** resets all three in one action.
- Existing columns with hidden tasks say **No matching tasks**; genuinely empty columns still offer **Add a task**.
- A board with tasks but zero results explains **No tasks match these filters.**
- Clearing filters returns keyboard focus to Search tasks and never rewrites Markdown.

## UI review checklist

| Area               | Contract                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Loading            | Filtering is synchronous; use the existing board loading and save states.                     |
| Empty              | Distinguish no columns, empty columns, and populated columns with no matching tasks.          |
| Error              | Recovery does not write data; preserve the existing save-error, retry, and conflict behavior. |
| Optimistic         | Apply view changes immediately; task mutations keep the existing persistence queue.           |
| Accessibility      | Labeled controls, pressed task-scope state, live no-results status, visible keyboard focus.   |
| Micro-interactions | A reset removes the no-results notice and restores cards immediately.                         |
| Pagination         | No new pagination; columns keep their existing local horizontal scrolling.                    |
| Visibility         | Local notes require no account or network access.                                             |
| Responsive         | Recovery remains visible and at least 44px tall on a narrow viewport.                         |
| Themes             | Use existing semantic foreground, muted, primary, and border tokens.                          |

## Verification

```sh
PLAYWRIGHT_PORT=5203 npm run test:e2e -- tests/e2e/task-filter-recovery.spec.ts tests/e2e/task-note.spec.ts --platform osx --suite browser --project chromium --workers 1 --retries 0
npm run typecheck
npm test -- packages/editor/src/app/components/tasks-dialog.test.tsx packages/editor/src/lib/task-note.test.ts
```

The new browser regression covers unmatched queries, combined filters with hidden columns, keyboard recovery, real empty columns, narrow layout, and persistence after reload. The existing task-board suite covers card editing, dragging, save failures, conflicts, and light/dark rendering.

Screenshots and a Playwright-recorded walkthrough are in [evidence/task-filter-recovery](evidence/task-filter-recovery/).

## Observed results

- Production build, typecheck, and scoped lint passed.
- Ten task serialization and manipulation unit tests passed.
- All nine existing task-board browser scenarios passed, including persistence, dragging, recovery, and conflicts.
- All six new browser scenarios passed against the production preview, with no retries.
- The CI platform matrix runs both task-board specs on Windows, macOS, and Linux.
- The screenshot matrix covers 1440px desktop and 390px phone widths in light and dark themes. Captures wait for fonts and finite animations to finish.
- The video is the actual Playwright walkthrough, converted from WebM to MP4 for playback.

Repository build warnings and unrelated React development warnings remain outside this focused change. No native-device or screen-reader session was performed.
