# PR 27 review evidence

Reviewed feature commit: `939105f320ffe59323de8263df657786a9e45820`.

Verdict: **Changes recommended before approval**.

## Walkthrough

[Watch the browser recording](./walkthrough.mp4) (1440 x 1000, approximately 24 seconds).

The recording shows the original uneven Markdown, its formatted rendering, pasting into another note, editing, saving with Cmd+S, and reloading. Assertions verify four columns, padded short rows, the overflow cell's bold/italic/code formatting, surrounding prose, and saved text after reload. Clipboard input uses a synthetic plain-text paste event through the editor's real paste handler; system clipboard integration is outside this test.

![Uneven table preserved after saving and reloading](./saved-and-reloaded.png)

## Finding: P2 - leading indentation breaks table repair

[`markdown-table.ts:42-46`](https://github.com/g4rcez/writeme-editor/blob/939105f320ffe59323de8263df657786a9e45820/packages/editor/src/lib/markdown-table.ts#L42-L46) slices the original matched source using the lengths of capture groups that exclude leading spaces. A leading space on the header or delimiter therefore offsets the suffix incorrectly and produces an invalid normalized delimiter. The custom tokenizer falls back to Marked, which either renders the table as prose or discards overflow cells.

Reproduced through the browser editor's plain-text paste handler with this input. There is one leading space on the first line:

```markdown
 | A | B |
| --- | --- |
| one | two | MUST KEEP THIS CELL |
```

Expected: three columns, with `MUST KEEP THIS CELL` retained. Observed: two columns, with that text missing. Using a three-column delimiter instead renders the entire table as raw Markdown. Direct tokenizer checks also reproduce the problem with one, two, and three spaces.

![Leading-space reproduction loses the third cell](./leading-space-cell-loss.png)

Derive the suffix from the actual second newline in the original match, or reconstruct it from the captured body, and cover leading indentation on both header and delimiter in parser/browser regressions. No application code was changed during this review.

## Validation

| Check | Result |
| --- | --- |
| Existing browser scenarios: normal/large opening and pasting, save/reload | 4 passed |
| Recorded walkthrough | 1 passed |
| Additional browser regressions: indented mismatched delimiter and indented overflow body | 2 failed, confirming the finding |
| Table parser, Markdown integration, worker unit tests | 38 passed |
| Root TypeScript check | Passed |

Commands:

```sh
npm run test:e2e -- --platform osx --suite browser --project=chromium --grep 'uneven markdown table'
npm test -- --run packages/editor/src/lib/markdown-table.test.ts packages/editor/src/lib/markdown-worker/markdown.worker.test.ts packages/editor/src/app/extensions/tiptap-markdown/Markdown.test.ts
npm run typecheck
```

Browser evidence comes from desktop Chromium on macOS using the repository's Vite/Playwright browser runner. It does not establish native Electron or physical-device behavior. Existing development-server warnings, including duplicate React keys and a transient module fetch error, appeared during the passing run; they were not repaired or attributed to this PR.
