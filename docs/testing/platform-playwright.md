# Platform Playwright suites

Use one entry config per platform: `playwright.windows.config.ts`, `playwright.ios.config.ts`, `playwright.osx.config.ts`, `playwright.linux.config.ts`, and `playwright.android.config.ts`. Shared selection and server setup live in `scripts/playwright-platform.ts`; no feature-specific root configs remain.

```sh
npm run test:e2e -- --platform osx --suite browser tests/e2e/data-safety.spec.ts --project chromium
npm run test:e2e -- --platform osx --suite production --project desktop-macos
npm run test:e2e -- --platform osx --suite native tests/native/freehand-note.spec.ts
```

Both selections are required. Remaining arguments go to Playwright, including filename filters, `--grep`, `--project`, `--workers`, `--list`, and `--ui`. `--config` is deliberately rejected; select a platform instead. Unsupported combinations fail explicitly. `--project` selection also narrows server/build setup, so selecting `native-store` does not start the two renderer-profile servers. `--list` does not build or start applications.

## Test map

| Suite | Platforms/projects | Existing verification |
| --- | --- | --- |
| `browser` | Windows/Linux: `chromium`; OSX: `chromium` and `desktop-macos`; iOS: `ios-phone`, `ipad`; Android: `android-phone`, `android-tablet` | Desktop Chromium recursively discovers `tests/e2e/**/*.spec.ts`, excluding production-only scenarios and operator recordings. OSX WebKit and mobile phone/tablet projects run `freehand-note.spec.ts`, preserving portable handwriting and Chromium-only input distinctions. |
| `production` | Desktop `chromium`, OSX handwriting `desktop-macos`; mobile phone/tablet plus `ios-web-drawing`/`android-web-drawing` | Discovers `*-production.spec.ts` or scenarios tagged `@production`. Handwriting remains on WebKit on OSX and phone/tablet engines on mobile; meeting/media checks stay on desktop Chromium. Mobile drawing projects run `tests/mobile/excalidraw.spec.ts` against the root web bundle with service workers blocked only for drawing. |
| `native` | `native-windows`, `native-osx`, `native-linux` | Recursively discovers portable `tests/native/**/*.spec.ts`: compiled and packaged handwriting, meeting, completion, comments and Vim persistence. `build-profiles.spec.ts` belongs to `profiles`; `application-menu.spec.ts` is selected only on OSX, not runtime-skipped elsewhere. |
| `profiles` | OSX: `macos-app-store`, `macos-homebrew`, `native-store`; iOS: `ios-app-store`; Android: `android-google-play` | All `tests/build-profiles/*.spec.ts`, plus `tests/native/build-profiles.spec.ts` on `native-store`. Preserves renderer capability restrictions and compiled main/preload rejection of privileged APIs/direct IPC. No existing Windows/Linux restricted-profile scenarios are invented. |
| `mobile` | `ios-phone` or `android-phone` | All `tests/mobile/*.spec.ts` against the shared mobile production shell: touch/AI exclusion, Markdown and PDF persistence, background saves, offline note creation, backup import/export and failure recovery, and embedded/full-page drawing. |
| `landing` | `chromium` | `tests/landing-downloads.spec.ts`. CI runs it on Linux rather than multiplying the same landing checks across platforms. |
| `device` | Android: `physical-android` | `tests/device/freehand-note.spec.ts`: real connected Android hardware, trusted pen/pressure measurement, and persistence across Chrome restart. Never replaced with emulation. |

CI runs complete suites, not feature-file allowlists. Adding a browser or native regression no longer requires editing a workflow. Production filenames ending in `-production.spec.ts` are discovered automatically; use `@production` for other production scenarios and `@production-only` when they must not run against the development server. A shared scenario such as Vim settings can use `@production` without `@production-only`. Mobile root drawing and mobile-shell drawing remain distinct surfaces.

OSX needs both engines: WebKit represents existing Safari handwriting/offline checks, while Chromium supports the media flags and fake microphone fixture used by meeting tests. `@chromium-input` scenarios remain excluded only from WebKit. Chromium production tests use actual offline mode; WebKit uses the existing app-server-outage proxy because its offline emulation rejects service-worker navigation. Neither mechanism establishes physical Safari suspension/offline behavior.

## Desktop tab regression coverage

```sh
npm run test:e2e -- --platform osx --suite browser \
  tests/e2e/editor-tabs.spec.ts tests/e2e/tab-rename.spec.ts \
  tests/e2e/recently-closed-tab.spec.ts tests/e2e/editor-tab-drag.spec.ts \
  --project chromium
```

The scenarios cover creating and selecting tabs, reopening an existing note without duplicate tabs, committed/cancelled rename persistence, background/active/last-tab closure, preserved note contents, tab order after reload, restoration in reverse closing order, and restoration of a note already reopened manually. Drag scenarios cover reordering, split groups, copying, and cancellation; cancellation waits for the visible drag ghost to disappear before releasing the pointer.

Rename setup waits for the note route and editable, focused editor before double-clicking the tab title, so delayed editor autofocus cannot dismiss the rename input. Restoration captures the settled note URL rather than the home route. The two three-note closure/restoration scenarios and the reload/fresh-page persistence scenario allow 120 seconds for their full multi-navigation lifecycle on CI hosts; individual assertion timeouts and retry settings are unchanged.

Drag setup allows 30 seconds for the first note toolbar to mount after creation.
The cold Vite note route can still be loading after the dialog closes or the URL
changes; subsequent drag assertions retain their normal timeouts.

Closing a note tab must not delete its note. New or restored tabs append after the highest remaining persisted order, rather than using the open-tab count, which can collide with existing orders after closures. The persistence scenarios exercise real browser storage through reloads and a fresh page in the same browser context; they do not establish Electron/SQLite process-restart behavior. Recently closed history is session-only, while reopened tabs and their note contents persist.

## Build and server reuse

Only the selected suite's servers start. The browser suite uses Vite's development server because existing failure-injection and migration scenarios import source modules in the page; a built preview cannot serve those modules. Production previews the root `dist` bundle and builds it once unless `PREBUILT` is set. Native defaults to one `package:app` build and reuses its `.vite` compiled bundles and packaged application for every native scenario. Mobile builds only the mobile shell. Profile tests build only their selected renderer variants; selecting OSX `native-store` also prepares its compiled restricted main/preload/renderer through `scripts/build-native-profile.ts`.

For CI or sequential local production/native checks, build once and set `WRITEME_E2E_PREBUILT=1`. Browser scenarios require no production build:

```sh
npm run test:e2e -- --platform osx --suite browser tests/e2e/freehand-note.spec.ts --project desktop-macos
npm run browser:build
WRITEME_E2E_PREBUILT=1 npm run test:e2e -- --platform osx --suite production --project desktop-macos
npm run make
WRITEME_E2E_PREBUILT=1 npm run test:e2e -- --platform osx --suite native
```

`PREBUILT` is a promise that the selected artifacts exist and match the intended profile; missing/stale assets are not silently rebuilt. Native execution requires the matching host OS. Headless Linux Electron uses `xvfb-run --auto-servernum`. Production executable tests preserve the package's fuses and use Chromium transport; compiled bootstrap tests continue to exercise the real Electron main/preload APIs. No native persistence scenarios or storage assertions were removed.

After `ios:sync` or `android:sync`, the restricted mobile assets in `packages/mobile/dist` can serve both `mobile` and the matching renderer `profiles` suite without compiling a second copy:

```sh
npm run ios:sync
WRITEME_BUILD_PROFILE=ios-app-store WRITEME_E2E_PREBUILT=1 npm run test:e2e -- --platform ios --suite mobile
WRITEME_E2E_PREBUILT=1 WRITEME_E2E_PROFILE_DIR=packages/mobile/dist npm run test:e2e -- --platform ios --suite profiles
```

For OSX restrictions, prebuild `macos-homebrew` with `build:profile` and the native store variant with `WRITEME_BUILD_PROFILE=macos-app-store node --import tsx scripts/build-native-profile.ts` before using `PREBUILT=1`. The compiled store renderer also serves the `macos-app-store` project with `WRITEME_E2E_PROFILE_DIR=artifacts/build-profiles/macos-app-store/renderer/main_window`, so CI does not compile a duplicate store renderer. The default desktop package is `macos-direct`, not `macos-homebrew`; its renderer cannot replace the Homebrew channel assertion. Direct/native packages and restricted variants are different build contracts.

Landing alone starts Next.js. Its default server is `dev`; with `PREBUILT=1` it uses `start` and requires `npm --prefix packages/landing run build` beforehand. No landing dependencies or server start for other suites.

`PLAYWRIGHT_BASE_URL` selects an external browser/mobile/landing server and suppresses managed builds/servers. `PLAYWRIGHT_PORT` overrides the managed server port. `PLAYWRIGHT_ARTIFACT_DIR` overrides the default `artifacts/playwright/<platform>/<suite>/` folder (results, HTML report, JSON report). Use distinct artifact overrides when splitting one suite into multiple invocations so reports are not overwritten. Default and full runs record successful scenarios too; the fast gate uses the diagnostic policy below.

## Fast PR gate and full verification

The PR target is five minutes end-to-end, including runner setup, all required checks and the final gate—not five minutes per job. Required PR checks are:

- Shared root/mobile/test-infrastructure typechecks, automatically scoped lint, math/CLI units, runner discovery contracts and merge-gate contracts. Editor/build units run independently in two complete Vitest shards so they do not extend the typecheck/discovery critical path.
- Linux Chromium browser regressions run in the fast PR gate across sixteen shards, including dependency/browser installation, the Playwright command, and diagnostic artifact upload. Shards use four workers and disable continuous video/trace frames while retaining failure screenshots, explicit visual captures, DOM/source traces, and reports.
- One standalone MCP contract on Ubuntu with Node 24.18.0 and Deno 2.4.5.
- `All PR checks passed`, which fails for missing, failed, cancelled or skipped required results.

Fast jobs target five minutes and have a six-minute hard timeout to accommodate hosted-runner variance; a timed-out job still fails rather than hiding slow tests. The final gate has a one-minute limit and depends on all required checks. Browser execution runs in sixteen shards and still depends on hosted runner scheduling; report external GitHub queue time separately from execution time.

Browser creation setup submits once and waits for the newly created note UUID's editable editor, not a still-visible previous document. Content setup fills literal text in one browser edit, observes the unsaved state, saves through Ctrl/Cmd+S and waits for the saved state; fixture setup does not wait for the configured autosave delay or repeat reload verification. Dedicated typing, autosave and persistence scenarios remain unchanged. Keyboard and input-rule scenarios still exercise real keystrokes; heading setup uses the heading command, and reference setup pastes real Markdown through the editor's paste handler. Fast browser runs warm Vite's renderer and note-editor modules and leave the service worker disabled so dev-served source modules are not cached as if they were production assets.
Multi-note completion scenarios return through the app's Home action between notes; direct navigation to `/` intentionally restores the persisted active tab.
Daily capture closes its saved active tab before returning Home, because navigating to `/` restores the persisted active tab.
Core-page navigation waits for `DOMContentLoaded`, then asserts rendered route content instead of waiting for external-resource load completion.

Folder scenarios initialize real browser/IndexedDB persistence before exposing the mocked filesystem; starting as Electron would select native SQLite/IPC instead. Autocomplete options live in a portaled listbox, and typed custom names are committed by leaving the input before submission. Code paste targets the current Tiptap content and preserves the editor selection. List-spacing checks measure rendered grouping and text containment rather than pinning typography constants. Sticky-link movement/persistence and responsive control geometry run as separate scenarios so a multi-navigation case does not monopolize a worker.

`platform-verification.yml` is now orchestration only. Browser, desktop, mobile and web integrations live in reusable suite-level workflows; agents should add specs or production tags, not feature steps or filename lists. Full verification runs nightly at 03:00 UTC on the default branch and through `Full verification` workflow dispatch. Release publishing requires full platform verification and all six MCP OS/version contracts for the release commit.

The full pipeline retains Windows/macOS/Linux browser coverage (three shards per OS), Safari handwriting, all production and native scenarios, desktop packaging, mobile shell/profile tests and archives, landing verification, and checksum-verified live Whisper. Desktop packages and synced mobile assets are built once per platform job and reused. Landing and Whisper have independent Linux jobs rather than extending the desktop packaging critical path. No platform coverage has been deleted; it is deliberately outside the per-commit PR gate.

| Platform | CI host | Additional requirements |
| --- | --- | --- |
| Windows | `windows-2022` | Native Electron and Windows installers; this host retains node-gyp's supported Visual Studio toolchain. |
| OSX | `macos-latest` | Chromium media checks, WebKit handwriting, direct Electron packaging, and separately compiled restricted store/Homebrew variants. |
| Linux | `ubuntu-latest` | Xvfb for Electron, Debian/RPM tooling, landing build, and the pinned CPU Whisper server with checksum-verified cached model. |
| iOS | `macos-15` | WebKit phone/tablet emulation plus Xcode 26/Capacitor device archive compilation. The unsigned archive is not signed-install or real-device runtime proof. |
| Android | `ubuntu-latest` | Chromium phone/tablet emulation plus Java 21/Android SDK 36/Capacitor APK compilation. ADB pen-pressure scenarios still require an attached device and operator. |

The full pipeline is not subject to the five-minute PR budget. Signed/release builders remain separate from verification because their artifacts and signing contracts differ.

## Explicit external contracts

- Live Whisper is tagged `@live-local-whisper` and excluded from ordinary production runs, not reported as skipped. Set `MEETING_WHISPER_ENDPOINT` and absolute `MEETING_AUDIO_FIXTURE`, then select `--suite production --project chromium --grep @live-local-whisper` (the existing `live local Whisper` grep also works). Explicit execution fails if either prerequisite is missing. The dedicated full-pipeline Whisper job supplies both; `--list` needs neither.
- Recording the completion walkthrough requires `RECORD_COMPLETION_DEMO=1`; without it the recording file is not discovered. It is an operator recording, not required regression coverage.
- Android physical pen execution requires `PLAYWRIGHT_DEVICE_BASE_URL`, secure HTTPS/device-local localhost, ADB, a connected non-emulator device and an operator. Missing prerequisites fail, not skip. `--list` enumerates without requiring attached hardware. See [device checks](./handwriting-device-checks.md) for USB forwarding and pressure instructions. Physical iOS/iPad/Pencil, operating-system suspension, permissions, native sharing and signed-install behavior remain operator checks, not browser emulation.
- `packages/mcp/playwright.config.ts` remains an independent-package contract. The package has its own `test:e2e` script and tests the published MCP integration with packaged Electron in SQLite and filesystem modes. Folding it into root platform configuration would make the independent package depend on root-only runner modules. Run `npm exec -- playwright test --config packages/mcp/playwright.config.ts` after desktop packaging; the CI package suite and its contract layers remain separate.

## Enumeration and runner regression checks

These commands enumerate without building or launching servers:

```sh
npm run test:e2e -- --platform windows --suite browser --list
npm run test:e2e -- --platform ios --suite browser --list
npm run test:e2e -- --platform osx --suite browser --list
npm run test:e2e -- --platform linux --suite browser --list
npm run test:e2e -- --platform android --suite browser --list
npm run test:e2e -- --platform osx --suite production --list
npm run test:e2e -- --platform osx --suite native --list
npm run test:e2e -- --platform osx --suite profiles --project native-store --list
npm run test:e2e -- --platform ios --suite mobile --list
npm run test:e2e -- --platform android --suite device --list
npm run test:e2e:runner
```
