# Feature: Fix link paste over selected text behavior

## Problem

Pasting a URL while text is selected replaces the selected label with the domain-link preview node. The expected behavior is to keep the selected text and apply the pasted URL as a normal text link.

## Solution

- Register a normal `link` mark for custom-labelled anchors.
- Keep `domainLink` nodes for standalone URL content where the link text is the URL itself.
- In the editor paste handler, detect a single pasted HTTP(S) URL while the selection is non-empty, prevent the default paste, and apply the URL as a `link` mark over the current selection.

## Edge Cases

- Standalone URL paste/input should still become a domain-link preview node.
- Explicit markdown links like `[Project docs](https://example.com/docs)` should stay as text links.
- Mention links should not be parsed as regular external links.
- Empty selections should keep existing paste behavior.
- Non-URL clipboard text should keep existing markdown paste behavior.

## Task Breakdown

- [x] Locate URL paste/domain-link handling.
- [x] Add a normal text link mark for custom-labelled links.
- [x] Intercept URL paste on a non-empty selection and apply the link mark.
- [x] Add regression tests for selected-text URL paste and labelled markdown links.
- [x] Run targeted tests and type checks.
- [x] Perform self-review for simplicity, scope, and LESSONS.md compliance.

## Definition of Done

- [x] Selected text + pasted URL serializes as `[selected text](url)`.
- [x] Labelled markdown links remain text links in editor JSON and markdown serialization.
- [x] Existing domain-link previews still handle standalone URL content.
- [x] Targeted tests pass: `npm test -- src/app/extensions/link-paste.test.tsx src/app/extensions/mention-link.test.tsx`.
- [x] LSP diagnostics pass for changed source/test files; only an existing deprecated React type hint remains in `src/app/editor.tsx`.
- [x] Type checking attempted. `npm run typecheck` is blocked by existing `tsconfig.json` `baseUrl` deprecation; `tsc --noEmit --ignoreDeprecations 6.0` reaches pre-existing unrelated errors outside this fix.
- [x] Self-review complete: the fix is localized, selection-aware, and avoids changing standalone domain-link behavior.
