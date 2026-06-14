# Plan 012 Execution Notes — Trash/Recovery Spike

## Existing behavior inspected

- Filesystem mode in repository code already moves deleted notes to `.trash` when a note has a `filePath` and restore/move paths are handled during delete/restore flows.
- Database mode has existing `deletedAt` support and restore/empty-trash methods in db manager.

## Recommended v1 semantics (minimal)

1. Mark deleted notes with `deletedAt` in DB for all modes.
2. Keep filesystem files in a workspace `.trash` directory.
3. Add dedicated “Trash” view listing recoverable items.
4. Restore returns to original `originalFilePath` for filesystem notes.
5. Add permanent-delete and empty-trash actions with confirmation.

## Storage-mode rules

- **Filesystem**: path moves should validate target locations under the workspace root.
- **IndexedDB/DB mode**: rely on `deletedAt` and `originalFilePath` for restore semantics.
- **UI**: hide trashed notes from normal lists by default.

## Acceptance criteria for next implementation

- Deleting then restoring preserves content and file path.
- Empty-trash is irreversible and requires explicit confirmation.
- A trashed note cannot be accidentally edited unless restored.
- Restore/delete paths are tested under both filesystem and non-filesystem modes.
