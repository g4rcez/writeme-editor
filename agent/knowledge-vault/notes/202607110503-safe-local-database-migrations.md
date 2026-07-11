---
title: "Safe local database migrations across storage backends"
type: approach
scope: reusable
created: 2026-07-11
source: "Dexie-to-SQLite reliability refactor"
---

# Safe local database migrations across storage backends

## Trigger

When an application moves user-owned local data between storage engines while both stores may contain records.

## Approach

1. Inventory every persisted collection and define identity, conflict, credential, and retention rules before moving rows.
2. Validate each record at the privileged boundary, batch imports, and track imported, updated, identical, skipped, and failed counts per collection.
3. Make retries idempotent: missing records import, identical records succeed, and conflicts follow one explicit timestamp policy.
4. Keep the source after the first verified import. On the next startup, independently compare destination keys/counts before deleting the source.
5. Treat secrets separately: migrate only through the encrypted credential path and retain the source when encryption is unavailable.
6. For filesystem-plus-database deletion, delete the file first; remove metadata and related rows only after success. Return partial results so failures remain visible and retryable.
7. Verify with real temporary databases, forced partial failures, mixed-success deletion tests, typecheck, full builds, and an independent final review.

## Why it worked

A migration marker records intent, not correctness. Delayed cleanup plus independent destination verification protects users from partial writes, stale conflicts, serialization mistakes, and crashes. Separating filesystem operations from transactional database cleanup prevents metadata from disappearing while files remain orphaned.

## Reuse checklist

- [ ] Enumerate all stores and natural keys
- [ ] Define conflict and secret-handling policy
- [ ] Count and persist partial failures
- [ ] Verify destination independently on a later startup
- [ ] Keep failed destructive operations retryable
- [ ] Test against real temporary storage

## Links

- Related: `plans/CODE_REVIEW.md`
