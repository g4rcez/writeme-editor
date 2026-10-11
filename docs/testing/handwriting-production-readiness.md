# Handwriting production readiness

The implementation is a release candidate. Broad production sign-off requires the native CI matrix and physical tablet checks below; emulated device profiles cannot establish hardware stylus behavior.

## Local evidence on 2026-10-10

| Verification                                             | Actual runner                           | Result     | Report                                                                      |
| -------------------------------------------------------- | --------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| Seven desktop, phone and tablet profiles                 | macOS; mobile devices emulated          | 152 passed | `artifacts/playwright/readiness-matrix/report/index.html`                   |
| Built PWA persistence and network disruption             | macOS; seven browser profiles           | 14 passed  | `artifacts/playwright/handwriting-production/report/index.html`             |
| Compiled Electron renderer and SQLite restart            | macOS ARM64; isolated profile           | 1 passed   | `artifacts/playwright/handwriting-native/report/index.html`                 |
| Desktop Chromium feature scenarios                       | Native Linux ARM64 container            | 23 passed  | `artifacts/playwright/readiness-linux-native/development/report/index.html` |
| Built PWA persistence and offline writes                 | Native Linux ARM64 container            | 2 passed   | `artifacts/playwright/readiness-linux-native/production/report/index.html`  |
| Compiled and packaged Electron restart                   | macOS ARM64; isolated profiles          | 2 passed   | `artifacts/playwright/readiness-packaged-macos/report/index.html`           |
| Compiled and packaged Electron restart                   | Native Linux ARM64 container            | 2 passed   | `artifacts/playwright/readiness-linux-electron/report/index.html`           |
| Production PWA lifecycle, persistence and outages        | macOS; seven browser profiles           | 32 passed  | `artifacts/playwright/handwriting-lifecycle-final/report/index.html`        |
| Production PWA pen types and complete notebook suite     | macOS; seven browser profiles           | 57 passed  | `artifacts/playwright/handwriting-pens-verified/report/index.html`          |
| Existing handwriting, legacy notes and input regressions | macOS; Android tablet and iPad profiles | 14 passed  | `artifacts/playwright/handwriting-pens-regression/report/index.html`        |

The earlier 196 recorded checks passed without retries or skips. TypeScript checking, feature lint with warnings rejected, formatting and both application builds passed. The macOS package passed `codesign --verify --deep --strict` using an ad-hoc signature. The follow-up also built Electron with native Linux dependencies in an isolated container. RootLayout retains four pre-existing lint warnings outside the changed restoration effect; browser builds also retain existing warnings about large chunks, dynamic imports, eval and the terminal's browser dependency.

Reports include 211 WebM recordings. The original 203 were checked with ffprobe for readable metadata and positive duration; all eight follow-up Electron recordings were also fully decoded with ffmpeg without errors. Extra browser tabs and Electron windows produce additional videos. Native Linux Electron is now verified locally. Native Windows execution and physical pen/tablet checks remain unverified: this host has no Windows runtime or connected physical tablet. Xcode lists only a simulated iPhone; Android device tooling is unavailable.

The latest test addition passed 32 production-bundle checks on macOS across all seven profiles, without retries or skips. It adds 18 lifecycle checks covering distinct pages, sticky links, portrait/landscape control geometry, tab return, browser shutdown/restart and lost pen pointer capture. All 80 WebM files saved with this run passed ffprobe and full ffmpeg decoding, including report attachment copies and extra pages. The first matrix attempt exposed an obstructed close button in the test helper after mobile home navigation; the helper now uses the visible drawer collapse control. The final matrix passed after that correction. New test TypeScript, lint with warnings rejected and formatting checks passed.

A separate connected-Android pen test now records device metadata and trusted pressure events and checks persistence after Chrome restarts. Its missing-ADB preflight was exercised and failed with setup instructions, as required; this is guard verification, not a physical-device pass. The runner's pen scenario remains unverified without a connected tablet. [Device setup and operator scenarios](./handwriting-device-checks.md) provide executable Android commands and concrete iPad/Android acceptance steps with video evidence requirements.

The pen follow-up passed 57 production checks without retries or skips, including 25 new checks for Fountain, Ball, Brush and Pencil rendering, pressure, shading, dots, undo/redo, erasing, reload integrity, keyboard access, themes and control geometry. A further 14 existing regression checks passed for legacy notebooks, palm rejection, touch navigation and save retries. All 186 production-run WebM files and 28 regression-run files passed positive-duration ffprobe checks and full ffmpeg decoding; these counts include report copies and extra browser pages. Final light/dark picker screenshots were inspected. Application TypeScript, direct test TypeScript, new-file lint, formatting and workflow YAML validation passed. Two existing accessibility lint warnings in the shared canvas's PDF page keyboard handler still prevent the workflow's strict feature lint from passing; they predate the pen changes. Development regression runs also emitted existing React mount warnings when creating notes. These macOS browser runs do not verify native Windows/Linux execution or physical stylus hardware for the new pens.

## Issues fixed during the readiness review

- Concurrent editors could replace newer saved ink with an older notebook snapshot. Saves now use the repository's compare-and-set operation and preserve local work on conflicts.
- Failed saves provided no recovery download. The notice and navigation dialog now export the complete local notebook as Markdown; tests verify the exported ink differs from the newer saved version.
- Navigation could discard changes while saving. It now waits for persistence, offers recovery after failures and requires an explicit choice to leave unsaved work. Browser unloads are guarded while dirty.
- Returning home reopened the active note immediately. Active-tab restoration now runs only at startup; Electron restart coverage verifies restoration still works.
- Dark paper lacked light ink. White ink is available and persists in saved strokes.
- Parsing removed extension fields and could interpret unsupported versions as legacy notes. Extension fields survive saves; unsupported schemas and unsafe coordinates leave the original note intact.
- Erasing imported strokes sampled along their entire length, which could freeze the renderer. Segment intersection now scales with point count; browser scenarios erase strokes up to one trillion units long.
- Newly created notebook routes could not reload offline. The PWA now precaches its HTML shell and uses it for navigation.
- Native checks previously launched only the compiled renderer with a bootstrap. They now also launch the actual packaged executable, keep production fuses intact, record both launches and verify SQLite persistence after a full restart.
- Release verification previously ran against a separately packaged application. Each release build now tests its own packaged output before staging downloads; failures block publication and retain videos and reports.
- A Brush pen tap could produce an empty outline when its start/end tapers overlapped. Tapers now scale with stroke length; every pen type has a visible-dot and reload scenario.

## Automated release gate

`.github/workflows/handwriting-e2e.yml` runs types, feature lint, recorded browser scenarios, production-bundle checks and both compiled and packaged Electron persistence on native macOS, Windows and Linux runners. It has no test retries. `.github/workflows/release.yml` requires this workflow and a packaged-app check inside each platform's release build before publication, and downloads only application artifacts into the release. These workflow changes are local until they land in the repository; Windows has not passed remotely for this working tree.

See [handwriting-playwright.md](./handwriting-playwright.md) for commands, profiles and artifact locations. CI includes the new lifecycle suite and checks its TypeScript directly because the application tsconfig excludes tests. The physical-device command is separate from emulated CI and does not silently skip absent hardware. The native smoke test isolates its profile from the user's notes and checks both renderer reload and application restart. Packaging verification here uses an ad-hoc macOS signature; it does not establish notarized installer behavior.

Chromium production checks disable browser networking before reloading and writing new ink. WebKit checks an unavailable app server because [Playwright's WebKit offline emulation rejects service-worker navigation](https://github.com/microsoft/playwright/issues/42775). Server-unavailability recovery is useful evidence, but actual Safari offline reopening remains a physical-device check.

## Required device sign-off

Before claiming broad tablet support, record a pass on a physical iPad with Apple Pencil and an Android tablet with a supported pen:

1. Write with pressure, rest a palm on the screen and verify no unwanted ink or scrolling.
2. Pan and pinch with fingers, enable finger drawing and verify the gesture modes remain distinct.
3. Rotate between portrait and landscape while using ink, paper controls and sticky note links.
4. Background and reopen the app, then close and reopen it offline; verify ink, linked notes, pages and paper settings survive.
5. Exercise the operating-system color picker and follow sticky links to another note.

The native Windows Electron job must pass for this exact revision before release. A Windows-named browser profile running on macOS cannot establish that result. Linux ARM64 was verified locally; the release's Linux x64 job must still test its own output.
