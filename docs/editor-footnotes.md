# Markdown footnotes

Use `/Footnote` in the formatted editor to name a reference and its editable
definition, or leave the name blank to use the next available `fn-N` ID.
Writeme selects the new definition so you can write its content. Hover, focus,
or tap a reference to preview it. Choose **Go to definition** to edit it, then
**Return to reference** to continue writing. With a keyboard, focus a reference
and press ArrowDown to reach **Go to definition**. Escape closes its preview.

Footnotes use ordinary Markdown:

```markdown
A claim [^source] and another claim [^source].

[^source]:
    A **formatted** source with [a link](https://example.com).
    A continuation line.

    Another paragraph.

    - A supporting detail
        - A nested detail
```

Continuation blocks use four spaces or one tab; Writeme writes four spaces.
Definition content supports the editor's existing Markdown formatting. IDs may
contain non-whitespace characters except brackets and backslashes. Custom IDs
must be unique; invalid or already-used names are rejected. Change an existing
ID and its references together in the Markdown view. Automatic IDs reserve
names in both references and definitions.

In table cells, escape pipes in reference IDs (`[^a\|b]`); the corresponding
definition keeps its logical ID (`[^a|b]: Source`). Writeme writes these table
escapes automatically, including when copying Markdown.

Multiple references can share one definition. Removing a reference leaves the
definition and other references intact. **Delete footnote** on a definition
removes every reference and duplicate definition with that ID as one undoable
action. Missing definitions get a preview message; definitions without references
are marked as unreferenced. Duplicate imported definitions are preserved and
marked; previews and navigation use the first definition.

Footnote references in inline or fenced code and escaped `\[^literal]` remain
literal text. Ordinary caret-labelled links, such as `[^manual](https://example.com)`
and `[^manual][target]` with a resolved link target, remain links. A footnote may
still be followed by unrelated parenthetical text.

Large-document worker chunks are ingested as rendered HTML, not parsed as
Markdown a second time. Fenced code and blank continuation lines survive
worker import, Markdown view, and saved reload. Definition discovery, reference
counts, and preview text share one document index rebuilt on content changes;
selection and return navigation do not rebuild it.

No companion file or app-specific Markdown syntax is required.
