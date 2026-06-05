# Opened tabs commander shortcut tasks

- [x] Confirm commander filtering, shortcut registration, and tab title lookup patterns.
- [x] Add an opened-tabs commander type.
- [x] Build opened-tab command items from sorted open tabs.
- [x] Register `Ctrl/Cmd+T` to open the opened-tabs commander.
- [x] Add/update regression tests for the shortcut list.
- [x] Run targeted tests and diagnostics.
- [x] Update spec Definition of Done with verification results.
- [x] Self-review: localized commander mode, existing shortcut registry reused, no raw color/styling changes, hook order remains safe.

## Verification

- `npm test -- src/app/elements/shortcut-items.test.tsx` — passed, 3 tests.
- `lsp_diagnostics` on changed source/test files — no diagnostics.
- `npm exec -- tsc --noEmit --ignoreDeprecations 6.0` — reaches existing unrelated project errors outside the opened-tabs commander changes.
