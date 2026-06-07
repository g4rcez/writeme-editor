# Task: Add homedir to global state

## Summary

Added a nullable `homedir` value to the global store and populate it through the existing Electron `env.getHome()` IPC API. Browser/PWA mode keeps `homedir` as `null` and never touches `window.electronAPI`.

## Changes

- `src/store/global.store.ts`: added `homedir: string | null`, `loadHomedir()`, and Electron-only loading during `init`.
- `src/app/main.tsx`: awaits global-store initialization now that `init` can resolve Electron state asynchronously.
- `src/store/global.store.homedir.test.ts`: covers browser mode, Electron mode, and IPC failure fallback.

## Verification

- `lsp_diagnostics` on `src/store/global.store.ts`, `src/app/main.tsx`, and `src/store/global.store.homedir.test.ts`: no diagnostics.
- `npm test -- src/store/global.store.homedir.test.ts`: passed, 3 tests.
- `npm run typecheck`: failed on existing unrelated project errors, including unused imports in settings/sidebar files and pre-existing Tiptap Markdown/table typing errors; no touched-file diagnostics were reported by LSP.

## Review

Self-review found the change simple and scoped: Electron access is isolated behind `isElectron()`, missing/failed IPC degrades to `null`, and existing init state is preserved.

## Risks

- `homedir` is nullable by design; consumers must handle `null` in browser mode or if Electron IPC fails.
