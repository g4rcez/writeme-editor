---
name: tiptap-editor-scroll
description: Correct patterns for text selection dispatch and scroll in the writeme-editor Tiptap instance. Use when implementing selection navigation, find/replace, search result highlighting, or any code that scrolls to a ProseMirror position in this editor. Trigger on: editor.commands.setTextSelection, scrollIntoView, scrollTo, coordsAtPos, or any navigation to a match/result in the editor.
---

# Tiptap text selection and scroll in writeme-editor

## The two pitfalls that always appear together

### Pitfall 1: `editor.commands.setTextSelection` silently calls `.scrollIntoView()`

`editor.commands.setTextSelection` appends `.scrollIntoView()` to the transaction before dispatching. In writeme-editor the editor sits inside a custom scroll container (`#main-scroll-container`), not the document body. ProseMirror's `.scrollIntoView()` targets the wrong scrollable ancestor and either does nothing or jumps to the wrong position.

**Wrong:**

```ts
editor.commands.setTextSelection({ from: result.from, to: result.to });
// scrollIntoView() fires automatically — broken in this editor
```

**Right:** dispatch the selection transaction yourself using `editor.view.dispatch`:

```ts
const selTr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, result.from, result.to));
editor.view.dispatch(selTr);
```

Import `TextSelection` from `@tiptap/pm/state`.

### Pitfall 2: Synchronous `scrollToPos` races ProseMirror/React DOM updates

Calling the scroll helper immediately after `editor.view.dispatch(selTr)` reads coordinates before ProseMirror has painted the updated DOM. The computed `coords.top` is stale and the scroll lands at the wrong position.

**Wrong:**

```ts
editor.view.dispatch(selTr);
scrollToPos(editor.view, pos); // too early — DOM not yet updated
```

**Right:** wrap in `requestAnimationFrame`:

```ts
editor.view.dispatch(selTr);
requestAnimationFrame(() => scrollToPos(editor.view, pos));
```

## Correct patterns

### Custom scroll helper (`scrollToPos`)

The scroll container is `#main-scroll-container` (defined in `src/app/layouts/main.layout.tsx`). Use `coordsAtPos` to get the absolute coordinates of the target position, subtract the container's bounding rect, and target 1/3 from the top of the visible area.

```ts
function scrollToPos(view: EditorView, pos: number): void {
    const container = document.getElementById("main-scroll-container");
    if (!container) return;
    try {
        const coords = view.coordsAtPos(pos);
        const containerRect = container.getBoundingClientRect();
        const targetScrollTop = container.scrollTop + coords.top - containerRect.top - containerRect.height / 3;
        container.scrollTop = Math.max(0, targetScrollTop);
    } catch {}
}
```

### Safe selection dispatch

Never use `editor.commands.setTextSelection`. Build and dispatch the transaction directly:

```ts
import { TextSelection } from "@tiptap/pm/state";

const selTr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, from, to));
editor.view.dispatch(selTr);
requestAnimationFrame(() => scrollToPos(editor.view, from));
```

### Full navigation pattern (next/previous result)

As used in `src/app/extensions/search-replace.ts`:

```ts
nextSearchResult:
  () =>
  ({ editor }) => {
    const s = srStorage(editor);
    if (s.results.length === 0) return false;
    s.resultIndex = (s.resultIndex + 1) % s.results.length;
    editor.view.dispatch(editor.state.tr.setMeta(pluginKey, { forceUpdate: true }));
    const current = s.results[s.resultIndex];
    if (current) {
      const selTr = editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, current.from, current.to)
      );
      editor.view.dispatch(selTr);
      requestAnimationFrame(() => scrollToPos(editor.view, current.from));
    }
    return true;
  },
```

## Key file references

- `src/app/extensions/search-replace.ts` — `scrollToPos`, all navigation commands
- `src/app/components/find-replace-bar.tsx` — consumer of the extension commands
- `src/app/layouts/main.layout.tsx` — defines `id="main-scroll-container"`

## Checklist for diagnosing scroll/selection bugs

- [ ] Is `editor.commands.setTextSelection` used anywhere in the navigation path? Replace with `editor.view.dispatch(tr.setSelection(TextSelection.create(...)))`.
- [ ] Is `scrollToPos` (or any `scrollTop` assignment) called synchronously after dispatch? Wrap in `requestAnimationFrame`.
- [ ] Is `document.getElementById("main-scroll-container")` returning `null`? Check that the layout renders with that id before the editor mounts.
- [ ] Is `coordsAtPos` throwing? The `try/catch` in `scrollToPos` swallows it silently — add a `console.error` temporarily to confirm.
- [ ] Is scroll happening to the right element but the wrong position? Verify the 1/3-from-top math: `container.scrollTop + coords.top - containerRect.top - containerRect.height / 3`.
- [ ] After a `replaceAll`, are decorations stale? Dispatch a `setMeta(pluginKey, { forceUpdate: true })` transaction to force the plugin to rebuild decorations.
