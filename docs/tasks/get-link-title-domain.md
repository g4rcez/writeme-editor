# getLinkTitleDomain helper tasks

- [x] Inspect current domain-link display/config structure.
- [x] Refactor domain configs around a shared title function.
- [x] Implement and export `getLinkTitleDomain(url)`.
- [x] Add focused regression tests for known domains and fallback behavior.
- [x] Run targeted tests and diagnostics.
- [x] Update spec Definition of Done with verification results.
- [x] Self-review: one URL-title behavior, no unrelated editor behavior changes.

## Verification

## Manual Verification

- [x] Confirmed `DomainLinkDisplay` renders the same text returned by `getLinkTitleDomain(url)` through regression coverage.

## Command Checks

- `lsp_diagnostics` on `src/app/extensions/domain-link.tsx` and `src/app/extensions/domain-link.test.tsx` — no diagnostics.
- `npm test -- src/app/extensions/domain-link.test.tsx src/app/extensions/link-paste.test.tsx` — passed, 11 tests.
- `npm run typecheck` — blocked by existing TypeScript 6 `baseUrl` deprecation.
- `npm exec -- tsc --noEmit --ignoreDeprecations 6.0 2>&1 | rg "domain-link" || true` — no changed-file errors.
