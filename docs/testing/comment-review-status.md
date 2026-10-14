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
history deduplicate retries, including a replay after a newer transition. Fresh UI
actions use `createCommentStatusOperation` to assign a logical time strictly after
all retained events (or the current wall clock, whichever is later). Correcting a
fast device clock, including after importing a portable companion, therefore does
not disable Resolve/Reopen. This time is an ordering receipt, not necessarily the
device's wall-clock time. Retries keep the original operation ID and logical time;
they must never recreate the operation against newer history. An operation older
than a retained transition is ignored even after its own receipt has aged out. A
request for the current status does not append an event.

Duplicate slug sections combine their replies and history. Updating their status
removes old metadata from every matching section and writes one canonical block.
Metadata-looking text in fenced examples or replies is preserved as content.
Direct filesystem edits to the status line take effect when the note reloads.

The rich editor preserves standalone top-level metadata using a hidden block
Markdown node. Inline metadata-looking reply comments use a separate inline node
and stay in their original paragraph/list/quote context; opening or editing the
companion cannot turn them into authoritative status or history. The parser keeps
HTML block boundaries before checking authority, including the last metadata
comment before another block. Formatted/raw round trips retain status, history,
and reply comments. Markdown exports use the same companion content.

## Persistence and failure behavior

Browser updates derive status from the current companion inside the existing
Dexie transaction covering notes, derived comment rows, and note history. A failed
write rolls the transaction back. Concurrent replies and status changes read the
latest companion rather than replacing it with a stale copy. Imported matching
companions without database ownership are adopted by persisting
`metadata.commentSourceId` in that same transaction, including a no-change status
retry. Derived rows and the note snapshot commit together; failed row writes roll
back ownership, Markdown, and snapshots. Later direct companion saves continue to
synchronize those derived rows.

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

Coverage includes legacy sections, rich/raw inline status and history round trips,
bounded history, clock correction with retained and expired retries, duplicate
sections, partial filesystem recovery, stale writes, source deletion, imported
companion adoption and transaction rollback, direct companion saves, concurrent
replies, filtered resolved inspection, duplicate anchors, keyboard activation,
empty phone filters, offline PWA resolution/reopening, SQLite reload, direct
filesystem edits, and source rename. Existing comment lifecycle and narrow
light/dark layouts remain in the browser suite.
