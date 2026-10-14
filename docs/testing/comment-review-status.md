# Comment review status

Sentence comment threads can be resolved and reopened from their existing panel.
Resolving retains the highlighted source link, quote, and every reply. The panel
shows status, the unresolved count, an unresolved-only filter, and review history.
An active resolved discussion or reply composer remains visible while the filter
is enabled; the panel explains why the resolved discussion remains open.

## Portable companion format

The companion Markdown note remains the canonical representation. Each `## slug`
section optionally contains review metadata:

```markdown
## review-this-sentence

<!-- writeme-comment-status: resolved -->
<!-- writeme-comment-history: {"operationId":"unique-operation-id","status":"resolved","at":"2026-10-14T12:00:00.000Z"} -->

> Review this sentence.

- Original comment
- Reply
```

Old sections without metadata default to unresolved. Malformed history entries
are ignored. A reopen writes `unresolved` and records an event with the same
status. The latest 12 transitions are retained in order. Operation IDs in that
history deduplicate retries, including a replay after a newer transition. A
request for the current status does not append an event.

Duplicate slug sections combine their replies and history. Updating their status
removes old metadata from every matching section and writes one canonical block.
Metadata-looking text in fenced examples or replies is preserved as content.
Direct filesystem edits to the status line take effect when the note reloads.

The rich editor preserves these HTML comments using a hidden Markdown node, so
editing a companion in formatted mode and switching back to raw Markdown retain
its status and history. Markdown exports use the same companion content.

## Persistence and failure behavior

Browser updates derive status from the current companion inside the existing
Dexie transaction covering notes, derived comment rows, and note history. A failed
write rolls the transaction back. Concurrent replies and status changes read the
latest companion rather than replacing it with a stale copy.

Electron serializes in-process comment updates by source note ID, including after
a source rename. Existing conditional writes protect SQLite and filesystem notes
against concurrent edits. A stale write reports an error and can be retried. If a
file write succeeds before metadata persistence fails, its operation ID prevents
a retry from duplicating the event or replaying it over a newer status.

No separate status database or collaboration service is introduced. Filesystem
writes keep the existing comments contract's partial-write limits described in
[the original production review](note-comments-production.md).

## Verification commands

Use the Node version in `.nvmrc`. Browser and production tests launch a separate
server with `reuseExistingServer: false`; port 5289 isolates this feature.

```sh
npm run typecheck
npm run test -- --maxWorkers=4
PLAYWRIGHT_PORT=5289 npm run test:e2e -- --platform osx --suite browser tests/e2e/note-comments.spec.ts --project chromium
PLAYWRIGHT_PORT=5289 npm run test:e2e -- --platform osx --suite production tests/e2e/note-comments-production.spec.ts --project chromium
npm run test:e2e -- --platform osx --suite native tests/native/note-comments.spec.ts
```

Coverage includes legacy sections, rich Markdown round trips, bounded history,
duplicate sections, replay after newer status, partial filesystem recovery, stale
writes, source deletion, browser transaction rollback, concurrent replies,
filtered resolved inspection, duplicate anchors, keyboard activation, empty phone
filters, offline PWA resolution/reopening, SQLite reload, direct filesystem edits,
and source rename. Existing comment lifecycle and narrow light/dark layouts remain
in the browser suite.
