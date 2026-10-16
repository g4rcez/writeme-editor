# Note starter examples

## Motivation

A solo builder creating a first note sees a title field and an empty editor. The optional template selector appears only after they create a saved template. They cannot discover useful note structures or try supported Markdown without writing the example themselves.

## Constraints

Keep blank creation as the default. Preserve the chosen title and saved templates. Offer starters only for ordinary notes; daily quick capture and specialized note formats retain their own content contracts. No schema, storage, dependency, or network changes.

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Seed saved templates | Reuses template management | Creates persistent records without consent |
| Dedicated onboarding wizard | More guidance | Interrupts frequent note creation |
| Optional starter chooser | Available at the point of need | Adds one field to ordinary note creation |

## Recommendation

Offer Project brief, Reading notes, Weekly review, and Markdown playground in the existing dialog. Selecting a starter shows its purpose and an expandable Markdown preview. A saved template and a starter are mutually exclusive. The note title remains the user's input.

The selectors display “No starter example” and “No saved template” when inactive, rather than implying that the composed note is blank. Helper text explains that neither selected means blank content. Selecting one source replaces the other; clearing the active source returns to blank, while clearing an already inactive selector preserves the active source and its variable values.

## UI verification checklist

- Empty: neither content source is selected by default; helper text explains that the note starts blank.
- Loading and errors: starters are synchronous local content; existing creation errors retain title and selection.
- Optimistic state: create only through the existing persistence path.
- Accessibility: labeled chooser, keyboard options, native preview disclosure, focus retained by the existing modal.
- Interactions: selecting a saved template clears the starter and vice versa; inactive labels identify the unused source, clearing only affects that selector's source, and cancelling/reopening resets selection.
- Mobile: bounded wrapping preview and reachable creation button at 375px and narrow desktop widths.
- Pagination and authentication: no pagination or account requirement.
- Performance budget: no additional requests; starter catalog below 4KB; target chooser response below 200ms.

## Acceptance

Playwright must reproduce the missing starter chooser before implementation. Afterward it must verify preview, title preservation, creation and persistence after reload, blank creation, reset, saved-template compatibility, keyboard interaction, and mobile/theme behavior. Capture a representative screenshot and video for the PR.

Success is a first note created from a starter without visiting template settings. Its measurable behavior is covered by browser regression tests; no analytics provider is introduced.

## Verification and evidence

The baseline browser regression failed at the missing `Starter example (optional)` chooser. After the review follow-up, all five starter Playwright scenarios pass in the same Chromium invocation as all 21 tab scenarios (26 total), including the newer tab rename tests. The starter/template scenario verifies displayed labels, switching in both directions, clearing each active source, and preserving the other source when its inactive selector is cleared. All 24 create-dialog unit checks and typecheck pass. CI batches starters with desktop tab acceptance, preserving per-test screenshots/videos and leaving native/production suites separate.

```sh
npm run test -- --run packages/editor/src/app/components/create-note-dialog.test.tsx
npm run typecheck
PLAYWRIGHT_PORT=16330 npm run test:e2e -- --platform osx --suite browser tests/e2e/editor-tabs.spec.ts tests/e2e/tab-rename.spec.ts tests/e2e/recently-closed-tab.spec.ts tests/e2e/editor-tab-drag.spec.ts tests/e2e/note-starter-examples.spec.ts --project chromium
```

The browser suite starts its own Vite development server; the isolated port avoids other worktrees' servers. Screenshots wait for fonts, two animation frames, and finite animations. The original production-preview walkthrough below shows selecting and previewing a starter, creating a note with a custom title, and reloading its saved content. Recording uses optional action pacing; CI uses normal speed.

- [Desktop, light](evidence/note-starter-examples/desktop-light.png)
- [Desktop, dark](evidence/note-starter-examples/desktop-dark.png)
- [Phone, light](evidence/note-starter-examples/mobile-light.png)
- [Phone, dark](evidence/note-starter-examples/mobile-dark.png)
- [Walkthrough video](evidence/note-starter-examples/walkthrough.mp4)

The existing daily-capture browser test fails at its second return to Home after reload, because restored navigation takes it away from Home. The same failure reproduces in an unchanged `origin/main` worktree at `76d3cc2`; daily template creation, editing, and reload finish before that failure. This change keeps starters absent from quick capture and preserves the daily-note persistence path. Existing create-dialog formatting and lint warnings are outside this diff; new catalog and browser test files pass formatting and lint.
