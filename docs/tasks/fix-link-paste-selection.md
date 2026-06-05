# Fix link paste over selected text tasks

- [x] Locate URL paste/domain-link handling.
- [x] Add a normal text link mark for custom-labelled links.
- [x] Intercept URL paste on a non-empty selection and apply the link mark.
- [x] Add regression tests for selected-text URL paste and labelled markdown links.
- [x] Run targeted tests and type checks.
- [x] Update spec Definition of Done with verification results.
- [x] Self-review: localized fix, no raw color/style changes, no unrelated editor behavior changes except logging a previously swallowed migration error.

## Verification

- `npm test -- src/app/extensions/link-paste.test.tsx src/app/extensions/mention-link.test.tsx` — passed, 10 tests.
- `lsp_diagnostics` on changed source/test files — no errors; one existing deprecated `MutableRefObject` hint in `src/app/editor.tsx`.
- `npm run typecheck` — blocked by existing TypeScript 6 `baseUrl` deprecation.
- `npm exec -- tsc --noEmit --ignoreDeprecations 6.0` — reaches existing unrelated project errors outside changed files.
