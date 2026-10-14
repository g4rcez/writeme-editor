# Markdown footnotes

Use `/Footnote` in the formatted editor to insert a reference and an editable
definition. Writeme selects the new definition so you can write its content.
Hover, focus, or tap a reference to preview it. Choose **Go to definition** to
edit it, then **Return to reference** to continue writing. With a keyboard,
focus a reference and press ArrowDown to reach **Go to definition**. Escape
closes its preview.

Footnotes use ordinary Markdown:

```markdown
A claim [^source] and another claim [^source].

[^source]: A **formatted** source with [a link](https://example.com).
    A continuation line.

    Another paragraph.

    - A supporting detail
        - A nested detail
```

Continuation blocks use four spaces or one tab; Writeme writes four spaces.
Definition content supports the editor's existing Markdown formatting. IDs
may contain non-whitespace characters except brackets and backslashes. Change
an ID and its references together in the Markdown view. New footnotes choose
the first available `fn-N` ID, reserving IDs in both references and definitions.
Existing IDs are preserved through editing, Markdown view, clipboard, and saves.

Multiple references can share one definition. Removing a reference leaves its
definition and other references intact. Missing definitions get a preview
message; definitions without references are marked as unreferenced. Duplicate
imported definitions are preserved and marked; previews and navigation use the
first definition. Resolve duplicates in the Markdown view.

Footnote references in inline or fenced code and escaped `\[^literal]` remain
literal text. No companion file or app-specific Markdown syntax is required.
