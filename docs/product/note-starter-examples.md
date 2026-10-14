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

## UI verification checklist

- Empty: blank note remains selected without saved templates.
- Loading and errors: starters are synchronous local content; existing creation errors retain title and selection.
- Optimistic state: create only through the existing persistence path.
- Accessibility: labeled chooser, keyboard options, native preview disclosure, focus retained by the existing modal.
- Interactions: selecting a saved template clears the starter and vice versa; cancelling and reopening resets selection.
- Mobile: bounded wrapping preview and reachable creation button at 375px and narrow desktop widths.
- Pagination and authentication: no pagination or account requirement.
- Performance budget: no additional requests; starter catalog below 4KB; target chooser response below 200ms.

## Acceptance

Playwright must reproduce the missing starter chooser before implementation. Afterward it must verify preview, title preservation, creation and persistence after reload, blank creation, reset, saved-template compatibility, keyboard interaction, and mobile/theme behavior. Capture a representative screenshot and video for the PR.

Success is a first note created from a starter without visiting template settings. Its measurable behavior is covered by browser regression tests; no analytics provider is introduced.

## Verification and evidence

The baseline browser regression failed at the missing `Starter example (optional)` chooser. After implementation, all five starter Playwright tests and all 24 create-dialog unit checks pass. Typecheck and production browser build pass. CI runs the starter regression on desktop platforms.

```sh
npm run test -- --run packages/editor/src/app/components/create-note-dialog.test.tsx
npm run typecheck
npm run browser:build
npm exec vite -- preview --host 127.0.0.1 --port 5201 --strictPort
WRITEME_CAPTURE_EVIDENCE=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5201 PLAYWRIGHT_PORT=5201 npm run test:e2e -- tests/e2e/note-starter-examples.spec.ts --platform osx --suite browser --project chromium --workers 1 --retries 0
```

Screenshots wait for fonts, two animation frames, and finite animations. The production-preview walkthrough shows selecting and previewing a starter, creating a note with a custom title, and reloading its saved content. Recording uses optional action pacing; CI uses normal speed.

- [Desktop, light](evidence/note-starter-examples/desktop-light.png)
- [Desktop, dark](evidence/note-starter-examples/desktop-dark.png)
- [Phone, light](evidence/note-starter-examples/mobile-light.png)
- [Phone, dark](evidence/note-starter-examples/mobile-dark.png)
- [Walkthrough video](evidence/note-starter-examples/walkthrough.mp4)

The existing daily-capture browser test fails at its second return to Home after reload, because restored navigation takes it away from Home. The same failure reproduces in an unchanged `origin/main` worktree at `76d3cc2`; daily template creation, editing, and reload finish before that failure. This change keeps starters absent from quick capture and preserves the daily-note persistence path. Existing create-dialog formatting and lint warnings are outside this diff; new catalog and browser test files pass formatting and lint.
