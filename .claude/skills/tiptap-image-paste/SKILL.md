---
name: tiptap-image-paste
description: Diagnose and fix image paste/drop in Tiptap editors. Use when image paste is broken, images don't appear after paste, or drop insertion fails. Covers FileHandler extension, editorProps.handlePaste, and Electron IPC async pitfalls.
---

# Tiptap image paste/drop — diagnosis and fix

## The two pitfalls that always appear together

### Pitfall 1: Reading `editor.state.selection` inside an async callback

`FileReader.onload` fires asynchronously. Any `await` before the insert makes it worse (Electron IPC adds hundreds of ms). By the time the callback runs, the selection has moved.

**Wrong** (broken in both browser and Electron):

```js
fileReader.onload = async () => {
    // BAD: reads selection state after async delay
    editor.chain().insertContentAt(editor.state.selection.anchor, { type: "image", attrs: { src } }).focus().run();
};
```

**Wrong** (same problem, different order):

```js
fileReader.onload = async () => {
    editor.chain().focus().insertContent({ type: "image", attrs: { src } }).run();
};
```

**Right** — capture position synchronously, before `readAsDataURL`:

```js
const insertPos = pos ?? editor.state.selection.anchor; // synchronous
fileReader.readAsDataURL(file);
fileReader.onload = async () => {
    // ... awaits here are fine, insertPos is stable
    editor.chain().insertContentAt(insertPos, { type: "image", attrs: { src } }).focus().run();
};
```

### Pitfall 2: Plugin priority — `editorProps.handlePaste` runs AFTER extensions

ProseMirror plugin props run in plugin-registration order. Extension plugins (e.g. `FileHandler`) have higher priority than the editor's own `editorProps`. This means:

- Images in `clipboardData.files` (copy-image-from-browser) → **FileHandler.onPaste** intercepts first; `editorProps.handlePaste` never runs for those.
- Images only in `clipboardData.items` (macOS screenshots) → FileHandler gets no files → **`editorProps.handlePaste`** runs.

If you add image handling only in `editorProps.handlePaste`, browser-copied images silently fall through to FileHandler's default (which does nothing if `onPaste` is not configured or wrong).

## Correct patterns

### FileHandler.onDrop

`pos` is provided synchronously by the drop event. Use it directly.

```js
FileHandler.configure({
  onDrop: (editor, files, pos) => {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        editor.chain()
          .insertContentAt(pos, { type: 'image', attrs: { src: reader.result } })
          .focus().run();
      };
    });
  },
```

### FileHandler.onPaste

No stable position is available (the paste happened in the past). Insert as a markdown string with `applyPasteRules: true` — this lets Tiptap's markdown pipeline place it at the current selection, which is more robust than `insertContentAt` with a captured anchor.

```js
  onPaste: (editor, files, htmlContent) => {
    files.forEach((file) => {
      if (htmlContent) return false; // let Tiptap handle HTML paste normally
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const markdown = `![${file.name}](${reader.result} "${file.name}")`;
        editor.chain()
          .insertContent(markdown, { applyPasteRules: true })
          .focus().run();
      };
    });
  },
})
```

### editorProps.handlePaste (for items-only screenshots)

Capture the anchor synchronously before calling any async helper:

```js
handlePaste: (view, event) => {
  const items = Array.from(event.clipboardData?.items ?? []);
  const imageItems = items.filter(
    (i) => i.kind === 'file' && allowedTypes.includes(i.type)
  );
  if (imageItems.length === 0) return false;

  const editor = editorGlobalRef.current;
  if (!editor) return false;

  // Capture synchronously — before FileReader or any await
  const anchor = editor.state.selection.anchor;

  imageItems.forEach((item, i) => {
    const file = item.getAsFile();
    if (file) handleImageFile(editor, file, anchor, i);
  });
  return true;
},
```

### Shared helper with Electron IPC (handleImageFile)

When async work (IPC calls, fetch, etc.) precedes the insert, the position MUST be captured before any of it.

```js
export const handleImageFile = async (editor, file, pos = null, offset = 0) => {
  if (!editor) return;
  // Synchronous capture — do this FIRST, before readAsDataURL and before any await
  const insertPos = pos !== null ? pos : editor.state.selection.anchor;

  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = async () => {
    let src = reader.result as string;

    if (isElectron()) {
      // Multiple awaits here — insertPos is still valid because it was captured above
      try {
        await window.electronAPI.fs.mkdir(targetDir);
        const dir = await window.electronAPI.fs.readDir(targetDir);
        const result = await window.electronAPI.fs.writeImage(path, src);
        if (result.success) src = relativePath;
      } catch (e) {
        console.error(e); // fallback: insert base64
      }
    }

    editor.chain()
      .insertContentAt(insertPos, { type: 'image', attrs: { src } })
      .focus().run();
  };
};
```

## Checklist when image paste is broken

- [ ] Is `editor.state.selection.anchor` read inside `onload` or after any `await`? → Move it before `readAsDataURL`.
- [ ] Does `editorProps.handlePaste` handle images? → Check if FileHandler intercepts first (images in `files`). Both paths need to be fixed independently.
- [ ] Is the insert using `insertContentAt(node)` vs `insertContent(markdownString)`? For paste, the markdown string approach is more robust.
- [ ] Electron only: are there multiple IPC awaits before the insert? → The position captured before those awaits will be stale if the user has typed; consider using a markdown-string insert instead.
- [ ] Is `Image.configure({ allowBase64: true })` set? Required for data-URL images.
