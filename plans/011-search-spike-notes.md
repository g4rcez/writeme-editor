# Plan 011 Execution Notes — Integrated Search Spike

## Chosen first slice

- Implement one surface that searches note content and title for user-initiated query from command palette + dedicated search panel.
- Keep scope to desktop/electron and browser parity by normalizing note text extraction from `Note.content` and metadata.

## Storage/model assessment

- **Browser (Dexie)**: query can scan indexed content in notes rows.
- **Electron filesystem mode**: prefer search metadata plus cached content in DB; avoid scanning raw files every keystroke.
- **Electron db mode**: search notes table directly and include metadata fields used by UI (`title`, `noteType`, `tags`, `filePath`).

## UI/UX and navigation

- Entry point: command palette item + `Ctrl+P` search page fallback.
- Result item: note title + snippet + match context; navigating should open note and move cursor to match location.
- Reduce motion: keep transitions subtle and existing accessibility tokens for focus/selection.

## Open questions logged

- Whether to support `<<#tag`/facet filtering in v1.
- Whether to index by word stemming or substring only.
- Whether `.trash`/deleted notes are searchable.

## Recommendation

Proceed as a product slice that delivers discoverability first, then rank/weighting refinements in the next plan.
