# Ctrl+Tab editor tab cycling tasks

- [x] Confirm tab state, routing, and existing keyboard shortcut entry point.
- [x] Add a small tab-cycle helper used by `RootLayout`.
- [x] Wire `Ctrl+Tab` forward and `Shift+Ctrl+Tab` backward.
- [x] Add regression tests for wraparound forward/backward tab cycling.
- [x] Run targeted tests and diagnostics.
- [x] Update spec Definition of Done with verification results.
- [x] Self-review: localized renderer shortcut, no global Electron accelerator, no styling changes, no hook-order violations.

## Verification

- `npm test -- src/lib/tab-cycling.test.ts` — passed, 4 tests.
- `lsp_diagnostics` on `src/app/root-layout.tsx`, `src/lib/tab-cycling.ts`, and `src/lib/tab-cycling.test.ts` — no diagnostics.
- `npm exec -- tsc --noEmit --ignoreDeprecations 6.0` — reaches existing unrelated project errors outside the tab-cycling changes.
