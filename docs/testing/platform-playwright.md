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
| `browser` | Windows/Linux: `chromium`; OSX: `chromium` and `desktop-macos`; iOS: `ios-phone`, `ipad`; Android: `android-phone`, `android-tablet` | Desktop Chromium runs all `tests/e2e/*.spec.ts` except production-only files below. OSX WebKit and mobile phone/tablet projects run `freehand-note.spec.ts`, preserving portable handwriting and Chromium-only input distinctions. |
| `production` | Desktop `chromium`, OSX handwriting `desktop-macos`; mobile phone/tablet plus `ios-web-drawing`/`android-web-drawing` | `freehand-production.spec.ts`, `freehand-lifecycle.spec.ts`, `freehand-pens.spec.ts`, `freehand-pen-dots.spec.ts`; desktop Chromium also runs `note-comments-production.spec.ts` and `meeting-note.spec.ts`. Mobile drawing projects run `tests/mobile/excalidraw.spec.ts` against the root web bundle with service workers blocked only for drawing. |
| `native` | `native-windows`, `native-osx`, `native-linux` | All `tests/native/*.spec.ts` except `build-profiles.spec.ts`: compiled and packaged handwriting/SQLite restarts, meeting microphone/transcript persistence, completion with real workspace files, comments in SQLite and filesystem modes, and macOS application-menu quit. The menu test explicitly skips on other OSes. |
| `profiles` | OSX: `macos-app-store`, `macos-homebrew`, `native-store`; iOS: `ios-app-store`; Android: `android-google-play` | All `tests/build-profiles/*.spec.ts`, plus `tests/native/build-profiles.spec.ts` on `native-store`. Preserves renderer capability restrictions and compiled main/preload rejection of privileged APIs/direct IPC. No existing Windows/Linux restricted-profile scenarios are invented. |
| `mobile` | `ios-phone` or `android-phone` | All `tests/mobile/*.spec.ts` against the shared mobile production shell: touch/AI exclusion, Markdown and PDF persistence, background saves, offline note creation, backup import/export and failure recovery, and embedded/full-page drawing. |
| `landing` | `chromium` | `tests/landing-downloads.spec.ts`. CI runs it on Linux rather than multiplying the same landing checks across platforms. |
| `device` | Android: `physical-android` | `tests/device/freehand-note.spec.ts`: real connected Android hardware, trusted pen/pressure measurement, and persistence across Chrome restart. Never replaced with emulation. |

The desktop Chromium browser selection retains all general editor/data-safety/recovery tests for local full-suite verification. CI supplies filename/project filters for the existing handwriting/meeting baseline; it does not add every previously ad-hoc editor scenario to every platform job. Mobile production drawing and mobile-shell drawing are distinct surfaces, not redundant coverage.

OSX needs both engines: WebKit represents existing Safari handwriting/offline checks, while Chromium supports the media flags and fake microphone fixture used by meeting tests. `@chromium-input` scenarios remain excluded only from WebKit. Chromium production tests use actual offline mode; WebKit uses the existing app-server-outage proxy because its offline emulation rejects service-worker navigation. Neither mechanism establishes physical Safari suspension/offline behavior.

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

`PLAYWRIGHT_BASE_URL` selects an external browser/mobile/landing server and suppresses managed builds/servers. `PLAYWRIGHT_PORT` overrides the managed server port. `PLAYWRIGHT_ARTIFACT_DIR` overrides the default `artifacts/playwright/<platform>/<suite>/` folder (results, HTML report, JSON report). Use distinct artifact overrides when splitting one suite into multiple invocations so reports are not overwritten. Videos are recorded on successful scenarios too, and failure traces/screenshots are retained.

## CI resource layout

The PR workflow has five platform verification jobs, one shared unit/type/lint job, six independent MCP package-contract jobs, and one merge gate: **13 runner jobs instead of 26**. Phone and tablet projects share their platform's install and servers instead of requiring separate runners. Each desktop builds distributables once and reuses that package for native verification; each mobile platform syncs its restricted assets once and reuses them for shell and capability checks. Landing verification runs only on Linux.

The six MCP jobs intentionally retain their standalone-package, Node/Deno-version, and operating-system matrix. They do not reinstall or package the editor. MCP's Electron integration now shares the OSX package. Independent release builders remain because signed/release artifacts need their own packaging and checks; tag workflows use 13 runner jobs instead of 18.

| Platform | CI host | Additional requirements |
| --- | --- | --- |
| Windows | `windows-2022` | Native Electron and Windows installers; this host retains node-gyp's supported Visual Studio toolchain. |
| OSX | `macos-latest` | Chromium media checks, WebKit handwriting, direct Electron packaging, and separately compiled restricted store/Homebrew variants. |
| Linux | `ubuntu-latest` | Xvfb for Electron, Debian/RPM tooling, landing build, and the pinned CPU Whisper server with checksum-verified cached model. |
| iOS | `macos-15` | WebKit phone/tablet emulation plus Xcode 26/Capacitor device archive compilation. The unsigned archive is not signed-install or real-device runtime proof. |
| Android | `ubuntu-latest` | Chromium phone/tablet emulation plus Java 21/Android SDK 36/Capacitor APK compilation. ADB pen-pressure scenarios still require an attached device and operator. |

Job counts describe configured resources, not a promised wall-clock speedup. Native compilation, the different restricted build profiles, and live transcription remain real work; compare completed GitHub runs to measure total duration.

## Explicit external contracts

- Live Whisper remains the existing `meeting-note.spec.ts` scenario. Set both `MEETING_WHISPER_ENDPOINT` and absolute `MEETING_AUDIO_FIXTURE`, then select `--suite production --project chromium --grep 'live local Whisper'` on a desktop platform. Without those external prerequisites the existing optional scenario skips; Linux CI supplies them and runs it explicitly.
- Recording the completion walkthrough requires `RECORD_COMPLETION_DEMO=1`; its intentional skip is unchanged.
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
