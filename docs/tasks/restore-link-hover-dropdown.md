# Restore full link hover dropdown tasks

- [x] Locate link preview and labelled link rendering paths.
- [x] Add hover preview rendering for `LinkMark`.
- [x] Improve full URL display in link previews.
- [x] Add regression coverage for labelled link hover trigger attributes.
- [x] Run targeted tests and diagnostics.
- [x] Update spec Definition of Done with verification results.
- [x] Self-review: localized link rendering change, no raw palette colors, mention/domain-link behavior preserved.

## Verification

## Manual Verification

- [x] Labelled links render an editor hover trigger with `data-link-url` and a full-link `title` fallback.

## Command Checks

- `lsp_diagnostics` on `src/app/extensions/link-mark.tsx`, `src/app/elements/link-preview.tsx`, and `src/app/extensions/link-paste.test.tsx` — no diagnostics.
- `npm test -- src/app/extensions/link-paste.test.tsx src/app/extensions/mention-link.test.tsx` — passed, 11 tests.
- `npm run typecheck` — blocked by existing TypeScript 6 `baseUrl` deprecation.
- `npm exec -- tsc --noEmit --ignoreDeprecations 6.0 2>&1 | rg "link-mark|link-preview|link-paste" || true` — no changed-file errors.
