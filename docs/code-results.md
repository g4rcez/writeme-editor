# Kept code results

Running code produces a temporary output. **Keep result** explicitly adds its plain-text stdout and stderr to the note. **Replace result** keeps the latest run instead; **Remove result** removes the stored record. These edits participate in the editor's undo history and normal note saving. Check the note's save status; after a storage failure the result remains in the editor and the save shortcut retries.

The result includes the execution timestamp, language, and SHA-256 fingerprint of the exact source text (UTF-8, including whitespace). Editing source or changing language labels the result **Outdated**. A matching fingerprint only identifies source text; it makes no claim about reproducibility, dependencies, environment, or external state. Viewing or importing results never runs code.

The combined stdout/stderr limit is 100,000 UTF-16 code units per result. Oversized results remain temporary; run code with smaller output to keep it. HTML previews cannot be kept. Output is saved only at the user's request and can contain sensitive data printed by their program.

## Markdown contract, version 1

A kept result is attached to the immediately following fenced code block:

````text
<!-- writeme-code-result:v1:BASE64URL_JSON -->
```javascript title="experiment.js"
2 + 2
```
````

Backtick and tilde fences are supported, including empty source blocks. The closing fence must use the same character as the opener and contain at least as many characters; the first valid closer ends the source. Following headings, prose, and adjacent code/result pairs remain separate document blocks. Fence indentation of up to three spaces and trailing spaces or tabs on the closer are accepted. Rich/raw roundtrips may normalize the fence spelling, while retaining source text and each block's own result.

`BASE64URL_JSON` is unpadded base64url of a UTF-8 JSON object:

```json
{
    "version": 1,
    "executedAt": "2026-10-14T12:30:00.000Z",
    "language": "javascript",
    "sourceFingerprint": "64 lowercase hexadecimal SHA-256 characters",
    "stdout": "4",
    "stderr": ""
}
```

Encoding prevents output from closing a comment/fence or introducing executable HTML. Other Markdown readers show the source code and ignore the metadata comment. Tools can decode the documented object to read output. Writeme reads kept output in all distributions, including mobile and store builds with execution disabled.

The comment and source fence form one portable unit. Move, copy, or duplicate them together in raw Markdown. The rich editor carries metadata on the code node, so reordering and duplication preserve the association without relying on document position or a global lookup. Duplicates are independent snapshots. Raw/rich switching, Markdown copy and export use the same representation. Separating the comment from its fence intentionally breaks that association. Unsupported or invalid records are not interpreted as results.
