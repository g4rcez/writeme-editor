---
name: tiptap-keyboard-shortcuts
description: Use when adding or debugging keyboard shortcuts in Tiptap extensions, especially when shortcuts involving Cmd/Ctrl (Mod-a, Mod-z, etc.) silently fail or browser default behavior overrides the handler.
---

# Tiptap Keyboard Shortcuts

## Two approaches — pick based on the key

### `addKeyboardShortcuts()` — safe for most keys

Works reliably for keys without a strong browser default: `Tab`, `Enter`, `Escape`, arrow keys, `Backspace`.

```typescript
addKeyboardShortcuts() {
  return {
    ...this.parent?.(),
    Tab: ({ editor }) => {
      if (getCurrentElementName(editor) !== "codeBlock") return false;
      return editor.chain().command(({ tr }) => {
        tr.insertText("    ");
        return true;
      }).run();
    },
  };
},
```

Returning `false` passes control to the next handler. Returning `true` (or the result of `.run()`) claims the event.

### `handleKeyDown` plugin — required for browser-native shortcuts

Use for `Mod-a`, `Mod-z`, `Mod-c`, `Mod-x` and any key the browser or OS handles natively. The keymap priority system can let other extensions or the browser win before your handler fires. `handleKeyDown` in a plugin fires at the ProseMirror event level and lets you call `event.preventDefault()` explicitly.

```typescript
// In addProseMirrorPlugins(), before ...(this.parent?.() || [])
new Plugin({
  key: new PluginKey("codeBlockSelectAll"),
  props: {
    handleKeyDown(view, event) {
      if (!(event.key === "a" && (event.metaKey || event.ctrlKey))) return false;
      const { state } = view;
      const { $from } = state.selection;
      if ($from.parent.type.name !== "codeBlock") return false;
      event.preventDefault(); // must be explicit here
      view.dispatch(
        state.tr.setSelection(
          TextSelection.create(state.doc, $from.start(), $from.end()),
        ),
      );
      return true;
    },
  },
}),
```

Import `TextSelection` from `@tiptap/pm/state`.

## Selection APIs

- `$from.parent.type.name` — name of the node containing the cursor
- `$from.start()` — content start of the innermost node (= `$from.start($from.depth)`)
- `$from.end()` — content end of the innermost node
- `$from.start(depth)` / `$from.end(depth)` — negative depths count up from innermost: `-1` = innermost, `-2` = parent, etc.
- `TextSelection.create(doc, from, to)` — programmatic selection

## Key name conventions

- `Mod-` maps to `Cmd` on macOS, `Ctrl` on Windows/Linux
- `Meta-` is macOS `Cmd` only
- `Ctrl-` is always the physical Ctrl key
- Case matters: `Mod-a` not `Mod-A`

## Common mistakes

- Using `addKeyboardShortcuts` for `Mod-a` — browser's select-all fires anyway because `preventDefault()` isn't guaranteed to be called before the browser acts
- Registering the plugin AFTER `...(this.parent?.() || [])` — parent plugins may claim the event first; put custom plugins before the spread
- Using `$from.start(-1)` when `$from.depth` is 1 — resolves to depth 1 (innermost), same as `$from.start()`, but the intent is unclear; prefer no-arg form
