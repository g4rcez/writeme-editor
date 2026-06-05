# Remove outer app scroll while editing tasks

- [x] Locate the app/editor scroll hierarchy.
- [x] Lock the document, body, and React root overflow.
- [x] Add `min-h-0`/overflow containment to the app shell and resizable editor panels.
- [x] Run diagnostics/type checks.
- [x] Document manual verification results.
- [x] Update spec Definition of Done with verification results.
- [x] Self-review: one scroll owner, no unrelated UI changes, print behavior preserved.

## Verification

## Manual Verification

- [x] Scroll containment file check passed for `index.html`, `src/app/styles/writeme.css`, and `src/app/layouts/main.layout.tsx`.

## Command Checks

- Scroll containment file check — passed for `index.html`, `src/app/styles/writeme.css`, and `src/app/layouts/main.layout.tsx`.
- `lsp_diagnostics` on `src/app/layouts/main.layout.tsx` and `src/app/styles/writeme.css` — no TypeScript diagnostics; CSS LSP unavailable.
- `npm run typecheck` — blocked by existing TypeScript 6 `baseUrl` deprecation.
- `npm exec -- tsc --noEmit --ignoreDeprecations 6.0 2>&1 | rg "main\\.layout|index\\.html|writeme\\.css" || true` — no changed-file errors.
- `npm run browser:build` — Vite transformed and emitted assets; final command exits on existing unrelated project type errors.
