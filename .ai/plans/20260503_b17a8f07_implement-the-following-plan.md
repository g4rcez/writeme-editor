# Implement the following plan:

_Session: b17a8f07-8efa-4328-9293-bb6a14bfaf08 | Saved: 2026-05-03 16:31:53_

## Prompt

Implement the following plan:

# Code block fence metadata (title)

## Context

Some markdown ecosystems (Docusaurus, MDX, Astro) attach key=value metadata to a fenced code block's info line, e.g.

````
```jsx title="/src/components/HelloCodeTitle.js"
function HelloCodeTitle(props) { ... }
```
````

The current parser (marked) only keeps the first whitespace token of the info string as `lang` — anything after (`title="..."`) is dropped on parse, and the serializer only writes `language` back. Goal: parse the full fence info string, persist `title` as a node attribute, render it as a static filename label on the left of the language selector, and round-trip it back to markdown on save.

User chose display-only behavior — no UI input for editing the title. It is set exclusively via the markdown source.

## Files to change

- `src/app/extensions/tiptap-markdown/parse/MarkdownParser.ts` — override marked's `code` renderer to capture fence metadata and project it onto `<pre data-title="...">`.
- `src/app/extensions/tiptap-markdown/extensions/nodes/code-block.ts` — append ` title="..."` to the opening fence in `serialize` when the node has a title.
- `src/app/elements/code-block.tsx` — add `addAttributes()` for `title`, surface it through the React node view, render as a label in `CodeBlockHeader`.

## Implementation

1. **Fence info parser (helper).** Add a small inline helper in `MarkdownParser.ts`:
   - Input: marked's `Tokens.Code.raw` (the full block including opening fence line).
   - Read the first line, strip leading `` ` `` or `~` fence chars, split on whitespace into `[lang, ...rest]`.
   - Match `title=` value supporting double-quoted, single-quoted, and bare token forms — regex: `/title=(?:"([^"]*)"|'([^']*)'|(\S+))/`.
   - Return `{ lang, title }`. Designed so additional keys (`showLineNumbers`, `highlight`, …) are easy to add later.

2. **Marked renderer override.** In `MarkdownParser.ts` constructor, after `this.md = new Marked(...)`, call `this.md.use({ renderer: { code(token) { ... } } })`:
   - Use the helper above on `token.raw` to extract title (also re-derive lang to be safe).
   - Build `<pre>` opening tag: include `data-title="..."` (HTML-escaped) only when title is present; omit otherwise.
   - Build `<code>` opening tag: include `class="language-X"` only when lang is present (matches base `@tiptap/extension-code-block`'s parseHTML, which reads the `language-` class from the `<code>` child).
   - Escape the body text with the same HTML-escape semantics marked's default code renderer uses (`& < > " '`). Keep it inline; no syntax highlighting (Shiki handles that downstream).
   - Output: ``<pre[ data-title="..."]><code[ class="language-X"]>${escaped}</code></pre>\n``.

3. **Serializer update.** In `extensions/nodes/code-block.ts`, change `serialize` so the opening fence line includes ` title="${escapedTitle}"` when `node.attrs.title` is truthy. Escape embedded `"` in the title via `\\"` (the same convention marked-style fences use — Docusaurus accepts this). Empty/null title emits no metadata.

4. **`addAttributes` on `ShikiBlock`** (`code-block.tsx`). Add an `addAttributes()` override returning the parent attrs plus a `title` attribute:
   - `default: null`
   - `parseHTML: (el) => el.getAttribute("data-title")` — receives the matched `<pre>` element, picks up the `data-title` set in step 2.
   - `renderHTML: (attrs) => attrs.title ? { "data-title": attrs.title } : {}` — keeps DOM round-trip intact (copy/paste, undo/redo).

   This is the same pattern used in `src/app/elements/blockquote.tsx`, `src/app/elements/callout.tsx`, and `src/app/elements/youtube-block.tsx`.

5. **React node view (`LanguageSelector`).** Read `props.node.attrs.title` alongside `language`. Pass it as a new `title` prop to `CodeBlockHeader`. No update handler — display-only.

6. **`CodeBlockHeader` rendering.** In the existing left cluster `<div className="flex gap-2 items-center">` (lines 468-520), insert the title label as the FIRST child, before the `Select`. Render only when `title` is truthy:

   - Element: `<span>` (semantic plain text label, not editable).
   - Classes: `text-xs text-muted-foreground font-mono px-2 py-1 rounded bg-muted/50 truncate max-w-64` — small, monospace (it's a filename), subtle background to distinguish from the language pill, truncate so long paths don't push the layout.
   - `title={title}` HTML attribute so the full path is reachable on hover when truncated.

   No new imports needed beyond what's already in `code-block.tsx`.

## Edge cases

- No title set: header layout is identical to today (label is conditionally rendered).
- Title with embedded double quotes: escape as `\\"` on serialize, parser regex captures the inner quoted form correctly because we match `[^"]*` lazily across the whole quoted region (no `\\` parsing — double quotes inside a `title="..."` are simply not supported, matching Docusaurus behavior).
- Language missing (`` ``` title="..." ``): renderer omits `class="language-..."` — base extension defaults to no language, header still shows the title.
- HTML in body (`<script>` inside code): escaped by the HTML-escape pass before being put inside `<code>`, so no injection.
- HTML in title: the title attribute value is HTML-escaped before being placed in `data-title="..."`. ProseMirror reads it back unescaped via `getAttribute`. Stored attr is the original string.

## Verification

- Open the Electron app in dev mode. Paste a markdown file containing `` ```jsx title="/src/components/HelloCodeTitle.js" `` — confirm the filename label appears at the left of the language Select, the language Select reads "Jsx", and the body renders highlighted by Shiki.
- Type a new code block in the editor with no metadata — confirm header has no label, only the Select.
- Open DevTools, inspect the `<pre>` for the labelled code block — confirm `data-title` is present.
- Round-trip: with the labelled note open, switch to a markdown source view (or trigger a save and read the file from `notes` storage) — confirm the fence reads `` ```jsx title="..." `` exactly.
- Edge case: paste a block with `title='single quotes'` — confirm parsed correctly.
- Edge case: paste a block with title containing spaces inside double quotes (`title="path with spaces.js"`) — confirm full path appears.
- Existing code blocks without titles must continue to serialize as `` ```language `` with no trailing metadata.


If you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: /Users/garcez/.claude/projects/-Users-garcez-Documents-g4rcez-writeme-editor/644040b4-d756-4399-b305-c091f1b0dfb7.jsonl

## Plan

Now the serializer in `code-block.ts`:

## Resolution

The fence block passes through unchanged. Valid `.md` and directory links still convert. Let me run the tests:
