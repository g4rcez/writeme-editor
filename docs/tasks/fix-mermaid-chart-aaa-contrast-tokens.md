# Fix Mermaid chart AAA contrast tokens tasks

- [x] Locate Mermaid render/theme configuration and CSS overrides.
- [x] Replace hardcoded theme values with token-backed Mermaid theme variables.
- [x] Replace raw Mermaid CSS colors with token-backed CSS variables.
- [x] Add regression coverage for critical Mermaid token mappings.
- [x] Run targeted tests and diagnostics.
- [x] Update spec Definition of Done with verification results.
- [x] Self-review: Mermaid node labels use a matched high-contrast token pair, CSS overrides no longer use raw HSL/hex colors, and the fix stays scoped to Mermaid colors/render safety.

## Verification

- `npm test -- src/app/elements/mermaid-theme.test.ts` — passed, 4 tests.
- `lsp_diagnostics` on changed Mermaid source/test files — no diagnostics; CSS LSP was unavailable, so CSS validity was covered by the test and edit tool CSS check.
- `npm exec -- tsc --noEmit --ignoreDeprecations 6.0` — reaches existing unrelated project errors outside the Mermaid changes.
