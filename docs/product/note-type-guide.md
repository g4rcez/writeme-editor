# Note type guide

## Motivation

Home offers several note formats without explaining when to use them. Someone recording a project plan or reading a paper has to infer which format fits. An optional guide lets them compare useful examples before committing to a note.

## Constraints

- Keep New note, its shortcut, and existing format actions immediate.
- Reuse the existing create dialog and immutable build capabilities.
- Keep notes local; no account, AI, dependency, or storage changes.
- Support keyboard navigation, assistive technology, and narrow screens.

## Options and trade-offs

| Option                                | Benefit            | Cost                                  |
| ------------------------------------- | ------------------ | ------------------------------------- |
| Add descriptions to every home action | Always visible     | Adds persistent clutter               |
| Replace New note with a wizard        | Guided choice      | Slows the primary writing path        |
| Optional Explore note types guide     | Examples on demand | One extra action for unfamiliar users |

## Recommendation

Add Explore note types beside the home actions. Show a compact radio list with a use case and concrete example for each supported format. Select Markdown initially. Selecting an option changes only the selection; Continue opens the existing creation dialog. Cancel, the close control, and Escape return focus to the trigger. Meeting notes require the meeting capability and a non-mobile platform.

## Acceptance

- Six formats always available: Markdown, Today's quick note, Task board, Handwriting, Excalidraw, PDF.
- Meeting notes available only when the build and platform support them.
- Every option has an accessible label and a concrete example.
- No note appears until the existing creation/import form succeeds.
- Keyboard arrows select formats; Tab reaches Continue and Cancel; Escape dismisses the guide.
- Options scroll at narrow heights; actions stay reachable; no horizontal overflow.
- Existing New note and keyboard shortcut still open the creation dialog directly.

## Performance and measurement

The guide reads static content and adds zero network requests. No editor or canvas is mounted by the guide. Opening the chooser should respond within 200 ms after the app is ready. The observable success signal is reaching the matching creation form without creating a note while browsing; Playwright verifies that signal. No analytics service is added to this local-first flow.

## Verification

The initial Playwright regression failed against the unchanged app because Explore note types was absent.

- Production Chromium: 17 checks cover the guide and existing home actions, six creation forms, actual task-note creation, keyboard selection, Escape/Cancel focus return, title-field focus after handoff, and no note creation while choosing.
- Responsive checks cover 375 x 667 and 667 x 375, footer actions at least 44px tall, and no horizontal overflow. Screenshots cover light/dark themes on desktop and narrow screens after fonts and animations settle.
- Capability checks cover meeting notes enabled on desktop, omitted on native mobile, and omitted with the immutable meetingNotes capability disabled.
- Existing creation-dialog unit tests: 17 passed. Typecheck, browser production build, formatting, and diff whitespace checks passed.
- Desktop platform CI runs this guide regression on Windows, macOS, and Linux.

```sh
PLAYWRIGHT_PORT=5202 npm run test:e2e -- tests/e2e/note-type-guide.spec.ts tests/e2e/dashboard.spec.ts --platform osx --suite browser --project chromium --workers 1 --retries 0
npm run browser:build
npm exec -- vite preview --host 127.0.0.1 --port 5202 --strictPort
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5202 PLAYWRIGHT_ARTIFACT_DIR=artifacts/playwright/osx/note-type-guide-production npm run test:e2e -- tests/e2e/note-type-guide.spec.ts tests/e2e/dashboard.spec.ts --platform osx --suite browser --project chromium --workers 1 --retries 0
WRITEME_DISABLE_FEATURES=meetingNotes PLAYWRIGHT_PORT=5202 PLAYWRIGHT_ARTIFACT_DIR=artifacts/playwright/osx/note-type-guide-restricted npm run test:e2e -- tests/e2e/note-type-guide.spec.ts --platform osx --suite browser --project chromium --workers 1 --retries 0 -g 'immutable build capability'
```

Stop the preview server before the separate capability run. The committed WebM is Playwright's finalized recording of opening the guide, choosing Task board, cancelling the existing form, and then creating a task note.

| Evidence                    | File                                                     |
| --------------------------- | -------------------------------------------------------- |
| Desktop dark                | [Screenshot](evidence/note-type-guide/desktop-dark.png)  |
| Desktop light               | [Screenshot](evidence/note-type-guide/desktop-light.png) |
| Narrow dark                 | [Screenshot](evidence/note-type-guide/mobile-dark.png)   |
| Narrow light                | [Screenshot](evidence/note-type-guide/mobile-light.png)  |
| Actual creation flow        | [Video](evidence/note-type-guide/guide.webm)             |
| Browser-compatible playback | [MP4 video](evidence/note-type-guide/walkthrough.mp4)    |

Existing production-build warnings about native config loading, externalized node:zlib, eval, large chunks, and ineffective dynamic imports remain outside this change. A separate task-board defect makes its default columns appear empty; this guide preserves the existing creation flow and does not change the board parser.
