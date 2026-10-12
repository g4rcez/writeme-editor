# Note comments production review

Reviewed on 2026-10-10 against the working tree based on `ce8bdc4130aa1cb6537052405b26b4b6ce49efd2`.

**Verdict:** the requested comments feature passed its production checks on Chromium and macOS ARM64 Electron. No outstanding blocker was found in the verified feature scope. This report covers the local implementation, not a deployed release or the readiness of unrelated features in the shared working tree.

## Behavior and storage

Selecting text in one paragraph exposes **Add comment**; `Ctrl/Cmd+Alt+M` also opens the comment form. Saving creates a highlighted Markdown link such as `[==Review this sentence.==](./comments_advisor.md#review-this-sentence)`. Clicking the highlight opens its sentence comments in the editor. The comments control also lists annotated text.

`plans/advisor.md` has the sibling reference note `plans/comments_advisor.md`. Selected words become slug IDs; repeated selections receive numeric suffixes. Replies share their existing `## slug` section. The companion retains its `comments_` title when opened or edited.

The web version stores threads in IndexedDB through Dexie: `comments` uses `[noteId+id]` as its primary key and indexes `noteId` and `referenceNoteId`. The companion is also a regular note. Schema upgrades backfill threads and reference aliases. Editing the companion updates the thread table. Browser source text, companion, comment rows, and history are committed in one transaction.

Electron uses SQLite for local notes and sibling Markdown files for filesystem workspaces. File creation is exclusive. Filesystem changes span separate writes; partial saves are reported and can be retried while the draft remains open. Recovery does not provide an atomic transaction across two files or a durable outbox across process termination.

## Issues corrected during the review

- Failed browser writes previously could leave a reference without its source highlight. Source and comment persistence now roll back together, with the draft available for retry.
- Concurrent browser replies and stale drafts now preserve saved content, and open panels refresh after another tab writes.
- Renaming source notes could hide annotations. Persisted reference aliases keep existing threads accessible in the web and Electron editors.
- Retry after a partial filesystem write could duplicate a comment. Operation receipts recover completed file writes before appending again; exclusive creation also preserves the winner of simultaneous file creation.
- Duplicate section IDs, literal highlight delimiters, multiline text, and Markdown hard breaks now round-trip without dropping comments or changing literal text.
- Untouched editors could save old content when switching modes. Unmount saves now require edited content; companion notes also bypass automatic heading-based renaming.
- The popup could render transparently or above its sentence on narrow screens. It uses the current card background token and recalculates position from editor state, scroll, resize, and content changes.
- Creation, loading, errors, retry, empty threads, readonly visibility, Escape, unique input IDs, and selection restrictions have explicit UI behavior.

## Verification

All final runs completed without failed or flaky scenarios.

| Check | Result | Evidence |
| --- | --- | --- |
| Whole unit suite | 169 files, 1,310 tests passed | [Unit results](../../artifacts/playwright/comments-full-unit-results.json) |
| Comments and browser data safety | 23 Playwright scenarios passed | [Browser results](../../artifacts/playwright/comments-browser-results.json) |
| Reference-note editing regression | Three consecutive runs passed | [Regression results](../../artifacts/playwright/comments-reference-title-results.json) |
| Production PWA | Offline creation/replies/reload and direct companion editing passed; no page errors | [PWA results](../../artifacts/playwright/comments-production-results.json) |
| Compiled Electron | SQLite and filesystem persistence, replies, reload, and source rename passed | [Native results](../../artifacts/playwright/comments-native-results.json) |
| TypeScript | Passed | `npm run typecheck` |
| Feature lint | Passed without code warnings in the new comments files and tests | `npm run lint -- <feature files>` |
| Production builds | Web/PWA build and Electron package succeeded | `npm run browser:build`, `npm run package:app` |
| Patch whitespace | Passed | `git diff --check` |

Browser coverage includes rollback at source/reference/table writes, retry without duplicates, source-scoped IDs, migrations, concurrent replies, stale source content, reference edits, trash/restore/permanent deletion, rename, keyboard cancellation, literal delimiters, HTML displayed as text, and narrow-screen geometry in both light and dark themes. Unit coverage additionally verifies real exclusive filesystem creation and partial-write recovery.

Screenshots from Playwright were inspected for the phone layouts, the production offline editor, and the native filesystem editor. The browser assertions verify viewport fit, placement below the annotated sentence, and an opaque background.

## Reproduce

```sh
npm run typecheck
npm run test -- --maxWorkers=4
PLAYWRIGHT_PORT=5284 npm run test:e2e -- --platform osx --suite browser tests/e2e/note-comments.spec.ts tests/e2e/data-safety.spec.ts --project chromium
npm run test:e2e -- --platform osx --suite production tests/e2e/note-comments-production.spec.ts --project chromium
npm run test:e2e -- --platform osx --suite native tests/native/note-comments.spec.ts
```

Native tests isolate application data and filesystem fixtures in temporary directories. They load the compiled packaged entry, rather than the development server. Generated JSON reports, traces, and screenshots are local artifacts under `artifacts/playwright/`, which is ignored by Git.

## Boundaries

Chromium and macOS ARM64 Electron were exercised. Physical mobile browsers, Safari, Firefox, Windows/Linux Electron, signed installers, and notarization were not verified in this run. No deployment was performed.

Existing editor/page lint warnings remain outside the new comments implementation. Development logs also show existing React key/mount warnings and editor-mode settings uniqueness warnings; successful production PWA verification reported no page errors. Web build warnings about module packaging, large chunks, and runtime code evaluation remain. These results establish the comments feature's verified behavior, not a warning-free application release.
