# Darken Mermaid item backgrounds tasks

- [x] Switch Mermaid item fills to the darker `primary-subtle` token.
- [x] Switch Mermaid item labels to `foreground` for contrast on darker fills.
- [x] Update Mermaid theme tests for token mapping and concrete resolution.
- [x] Run targeted tests and diagnostics.
- [x] Update spec Definition of Done with verification results.
- [x] Self-review: item backgrounds are darker, labels use semantic foreground, borders keep primary accent, no raw color additions.

## Verification

- `npm test -- src/app/elements/mermaid-theme.test.ts` — passed, 4 tests.
- `lsp_diagnostics` on changed Mermaid theme files — no diagnostics.
- `npm exec -- tsc --noEmit --ignoreDeprecations 6.0` — reaches existing unrelated project errors outside the Mermaid changes.
