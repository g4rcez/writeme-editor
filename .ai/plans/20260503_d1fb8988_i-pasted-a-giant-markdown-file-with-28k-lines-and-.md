# I pasted a giant markdown file, with 28k lines and the editor was frozed during 

_Session: d1fb8988-3ec3-44af-8eba-f2e30ff59392 | Saved: 2026-05-04 00:45:24_

## Prompt

I pasted a giant markdown file, with 28k lines and the editor was frozed during this time and was really slow. Make a way to optimize the import of giant markdown files, by showing a loading process, make the parse using service worker in background

## Plan

Now I have a complete picture. Let me call advisor before proposing approaches.

## Resolution

I have the full picture. Here's the refactor: extract the Tiptap setup into a memoized `TiptapEditorCore` that re-renders only when the current note/theme/content actually changes, and push global-store subscription up to a thin `InnerEditor` that wires `setEditorAllNotes` via `editorGlobalRef`.
