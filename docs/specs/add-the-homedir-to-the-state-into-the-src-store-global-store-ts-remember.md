# Feature: Add the homedir to global state

## Problem

The global store does not expose the user's home directory, so Electron-only UI and filesystem workflows cannot read a shared `homedir` value from state. Browser/PWA mode must not touch Electron IPC (`window.electronAPI`) because it is unavailable outside Electron.

## Solution

Add a nullable `homedir` field to `State` and `initialState` in `src/store/global.store.ts`. Populate it during store initialization by calling `window.electronAPI.env.getHome()` only when `isElectron()` is true; otherwise keep it `null` for browser mode.

## Edge Cases

- Browser/PWA mode has no `window.electronAPI`; the code must return `null` without touching Electron APIs.
- Electron IPC may fail or return no value; the store should keep `homedir` nullable instead of crashing initialization.
- Existing initialization state (`theme`, tabs, workspace directory, explorer root, notes) must remain unchanged.

## Task Breakdown

- [x] Inspect existing global-store initialization and Electron home-directory API.
- [x] Add `homedir` to state with an Electron-only initialization path.
- [x] Update the app initialization call if the dispatcher becomes asynchronous.
- [x] Run diagnostics/type checks for touched files.
- [x] Review for simplicity, browser safety, and scope control.
- [x] Document verification and close out the task.

## Definition of Done

- [x] Global state includes `homedir: string | null`.
- [x] `homedir` is populated only in Electron using the existing `env.getHome()` IPC API.
- [x] Browser mode never touches `window.electronAPI` for `homedir`.
- [x] Existing init behavior is preserved.
- [x] Tests/checks or manual verification are documented.
- [x] A staff engineer would approve this as simple and scoped.
- [x] Documentation updated.

## Verification Notes

- `lsp_diagnostics` on touched source/test files: no diagnostics.
- `npm test -- src/store/global.store.homedir.test.ts`: passed, 3 tests.
- `npm run typecheck`: attempted; failed on existing unrelated project errors outside the touched files.
