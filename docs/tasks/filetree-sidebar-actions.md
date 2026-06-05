# Filetree sidebar create actions tasks

- [x] Locate Explorer header buttons and existing TreeView create flow.
- [x] Add a controlled create request path from Explorer to TreeView.
- [x] Wire header actions in order: file, folder.
- [x] Add regression coverage for root header-style create requests and empty trees.
- [x] Run targeted tests and diagnostics.
- [x] Update spec Definition of Done with verification results.
- [x] Self-review: localized fix, no raw color additions, no unrelated tree behavior changes.

## Verification

- `npm test -- src/app/components/tree-view.test.tsx` — passed, 3 tests.
- `lsp_diagnostics` on changed source/test files — no diagnostics.
- `npm run typecheck` — blocked by existing TypeScript 6 `baseUrl` deprecation.
- `npm exec -- tsc --noEmit --ignoreDeprecations 6.0` — reaches existing unrelated errors outside the filetree changes.
