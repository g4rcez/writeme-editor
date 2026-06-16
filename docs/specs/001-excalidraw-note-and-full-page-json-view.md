# Excalidraw note and full-page specialized views

## Status

Implemented.

## Goal

Add a first-class Excalidraw note type whose stored content remains portable markdown: frontmatter plus a JSON code fence. Excalidraw notes render as a full-page Excalidraw canvas. Existing JSON notes should also render as a full-page specialized view without the current boxed/rounded/padded presentation.

## Decisions from investigation

- Excalidraw is a first-class note type: `NoteType.excalidraw`.
- Excalidraw note content includes frontmatter for interchange, but routing/rendering is based only on `note.noteType === NoteType.excalidraw`.
- Do not auto-render ordinary markdown notes as Excalidraw based on frontmatter alone.
- Commander gets a new action named `New excalidraw`.
- `New excalidraw` opens the create-note dialog to ask for the note title before creating the note.
- Excalidraw notes use a canvas-first page: no table of contents, note footer, linked-note references, or print/export button in v1.
- JSON notes and Excalidraw notes are specialized full-page note views: they keep the app shell/sidebar/tabs but fill remaining content area with no rounded card, border, or padding around the specialized view.

## Excalidraw markdown contract

New Excalidraw notes should initialize with this content shape:

````md
---
type: excalidraw
view: excalidraw
schemaVersion: 1
---

```json
{
  "elements": [],
  "appState": {},
  "files": {}
}
```
````

```

The JSON payload is the first `json` code fence. Saves should preserve the existing frontmatter and replace only that first JSON code fence payload.

## Implementation plan

### 1. Domain and creation plumbing

- Extend `NoteType` in `src/store/note.ts` with `excalidraw = "excalidraw"`.
- Extend `NoteCreationType` in `src/store/global.store.ts` to include `"excalidraw"`.
- Update `CreateNoteDialog`:
  - title text: `Create Excalidraw note` when `type === "excalidraw"`.
  - default title should use `getUniqueNoteTitle` like normal notes.
  - hide template picker unless `type === "note"`.
  - create content using the Excalidraw markdown contract when `type === "excalidraw"`.
  - create the note with `NoteType.excalidraw`.
  - navigate to `/note/:id` after creation.
- Add Commander shortcut under the Notes group:
  - title: `New excalidraw`.
  - action: close Commander, then open `setCreateNoteDialog({ isOpen: true, type: "excalidraw" })`.

### 2. Full-page Excalidraw note view

- Add a dedicated full-page renderer component, likely under `src/app/components/excalidraw-note-view.tsx` or `src/app/elements/excalidraw-note-view.tsx`.
- Reuse the existing `@excalidraw/excalidraw` dependency and parsing logic from `src/app/elements/code-block/excalidraw.tsx`, but adapt it for the full object payload:
  - parse first `json` code fence from markdown content.
  - accept `{ elements, appState, files }`.
  - tolerate legacy array payloads only inside this first-class Excalidraw note path by converting to `{ elements: array, appState: {}, files: {} }` if practical.
  - render the canvas full-page with current app theme.
  - debounce-save changes back to the markdown wrapper via `repositories.notes.updateContent` / `dispatch.updateNoteContent`.
- Invalid JSON behavior:
  - show a recoverable error state.
  - provide a reset action that writes an empty Excalidraw payload back into the existing markdown wrapper.

### 3. Specialized full-page layout in `NotePage`

- In `src/app/pages/note.page.tsx`, detect:
  - `isJson = note.noteType === NoteType.json`
  - `isExcalidraw = note.noteType === NoteType.excalidraw`
  - `isSpecializedFullPage = isJson || isExcalidraw`
- For specialized full-page notes:
  - bypass `Wrapper` or make `Wrapper` configurable so no TOC is rendered.
  - do not render `ExportNoteButton`, `PrintableNoteHeader`, `NoteReferences`, or `NoteFooter`.
  - use a page container that fills the remaining app content area.
- Update the JSON branch so `JsonGraph` fills the remaining page space with no outer rounded border/padding/card treatment.
- Render Excalidraw notes through the new full-page Excalidraw view.

### 4. Tests

Add/update focused Vitest tests where existing patterns support it:

- `src/store/note.test.ts`: `NoteType.excalidraw` can be created and parsed.
- `src/app/commander.test.tsx`: Commander includes `New excalidraw` and opens create dialog with `type: "excalidraw"`.
- `src/app/components/create-note-dialog.test.tsx` if existing dialog test setup is practical; otherwise add a focused test for the helper that builds Excalidraw markdown content.
- Full-page Excalidraw parsing/saving helper tests:
  - extracts first JSON fence.
  - preserves frontmatter on save.
  - resets invalid JSON to empty payload.

### 5. Validation

Run smallest reliable checks first:

- Targeted Vitest tests for changed units.
- `npm run typecheck` if targeted tests pass.

## Non-goals for v1

- No frontmatter-only auto-detection for ordinary notes.
- No Excalidraw-specific export/print button.
- No side-by-side markdown editor for Excalidraw notes.
- No database migration beyond adding the enum value, unless implementation discovers code requiring one.
- No new dependencies.

## Risks / watch points

- Excalidraw `onChange` can fire frequently; saving must be debounced. Do it, a debounce of 300ms, cancel any actions while the state is idle during this 300ms time
- `appState` may contain transient view properties; preserve useful fields but avoid causing infinite update loops.
- Existing embedded Excalidraw code blocks currently serialize an elements array. Avoid breaking that behavior while adding full-page note support.
- JSON full-page layout may depend on styles inside `JsonGraph`; if it has its own card/border/padding, remove or override those locally without affecting other uses.
```
