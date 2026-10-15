# Editor block actions

Hover a block and click its existing drag handle, or place the cursor in a block
and press **Alt+Shift+M**. Touch users can tap a block to reveal the handle.
The handle remains draggable.

The menu offers **Duplicate**, **Move up**, **Move down**, and supported
**Convert to** actions. Use the arrow keys, Home, End, or a label's initial
letter to navigate, and Enter or Space to activate. Escape or Tab closes the
menu and returns focus to its invoking control or editor.

Moves stay within the block's current parent. Nested list items move among
their siblings and keep their children and completion state. The first and
last items disable moves beyond their parent.

Paragraphs and headings can become paragraphs, headings 1–6, bulleted lists,
numbered lists, checklists, or quotes when the surrounding structure permits
the result. A quote containing one paragraph or heading can be unwrapped.
Inline formatting, links, note references, and hard breaks are retained. Explicit
**Quote** conversion keeps `[!NOTE]`-style text literal rather than turning it
into a callout, including after further edits. Ambiguous literal quotes are saved
as HTML blockquotes with `data-literal-quote="true"` in Markdown so reload keeps
their exact inline content and intent; ordinary quotes still use `>` syntax.
Typed or imported GFM callout markers remain supported, but only a contiguous
text prefix before any inline atom is treated as a marker.

Media, code, tables, list items, and complex quotes explain that conversion is
unavailable rather than discard content or metadata. A selection spanning
multiple blocks asks you to place the cursor in one block first, whether opened
by keyboard or by clicking a hovered handle. With a single-block selection,
hover targeting remains independent of the cursor's block.

All actions participate in normal undo and saving. Copies keep content and
metadata; copied headings receive new unique IDs. Markdown mode and reload
use the existing note serialization.

Verification:

```sh
npm test -- packages/editor/src/app/extensions/block-actions.test.ts
PLAYWRIGHT_PORT=5286 npm run test:e2e -- --platform osx --suite browser tests/e2e/block-actions.spec.ts --project chromium
```

Desktop PR verification runs the same browser scenarios on Windows, macOS,
and Linux.
