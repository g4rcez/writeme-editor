# Handwriting verification

Use Playwright as the primary feature check. Existing unit tests remain supplemental.

```sh
npm exec playwright -- install chromium webkit
npm run test:e2e:handwriting
npm run test:e2e:handwriting:report
npm run test:e2e:handwriting:production
npm run package:app
npm run test:e2e:handwriting:native
```

The matrix covers desktop macOS (WebKit), Linux and Windows (Chromium), Pixel 7, iPhone 13, Galaxy Tab S4 and iPad Pro 11 profiles. Every scenario records a WebM video, including successful tests. The HTML report embeds the videos; raw videos, screenshots and failed-test traces are in `artifacts/playwright/handwriting/results/`. JSON results include the requested platform and actual runner platform for each project.

Device profiles emulate viewport, pixel density, user agent and touch capabilities. A desktop profile's browser runs on the current host OS. Running `desktop-windows` on a Mac does not verify Windows. `.github/workflows/handwriting-e2e.yml` runs desktop projects on their matching macOS, Linux and Windows hosts and uploads the complete reports and videos for 14 days. Mobile profiles run on macOS in CI; physical Android, iOS and Pencil behavior still require devices.

The shared scenarios cover creation, drawing, highlighter, eraser, undo/redo, pages, reload persistence, touch input, responsive controls, save failure/retry, invalid content and legacy ink. Layout checks assert that the canvas fills the note workspace, floating controls leave writing space, remain stationary while panning, and can be hidden to access ink underneath. The compact toolbar is limited to 360px wide and 54px tall, with 44px touch targets. Ink and notebook panels are checked for keyboard focus, Escape dismissal, focus restoration, drawing outside the panel, reduced motion and reachable controls in portrait and landscape. Chromium projects additionally run browser-protocol tests for stylus pressure, palm input, touch pan/pinch and canceled pointers. These tests carry `@chromium-input`; WebKit projects run the portable touch scenario instead because CDP is a Chromium API.

Sticky note links are covered through the note picker, search and empty states, drag and tap placement, keyboard movement, undo/redo, per-page persistence, navigation, renamed and unavailable notes, save failure/retry and responsive layouts in both themes. Chromium projects also move links with pen and touch input and verify that canceled gestures leave the saved position unchanged.

Paper appearance checks cover custom background and pattern colors, hex validation, lines/grid/dots, spacing and weight, blank-paper controls, reset and undo/redo, shared page appearance and reload persistence without changing ink. The color and pattern controls retain 44px targets and remain reachable in phone portrait and landscape. Colors are entered through the hex fields; native operating-system color pickers require device testing.

The Pen tool offers Fountain, Ball, Brush and Pencil in a compact palette: select Pen, then select it again to choose a type. Fountain responds to pressure, Ball keeps a constant width, Brush adds stronger pressure variation and tapered ends, and Pencil combines a graphite texture with pressure shading. This follows the behavior described in [Goodnotes' pen guide](https://support.goodnotes.com/hc/en-us/articles/7353756785679-Write-and-customize-ink-with-the-Pen-tool) and [pencil guide](https://support.goodnotes.com/hc/en-us/articles/10730874907023-Create-lively-drawings-with-the-Pencil-tool). Color remains in Ink options; width can be changed in either palette. Each new pen stroke stores an optional `penStyle`; older strokes without that field keep their original rendering.

Production pen scenarios verify all four types, visible dots, erasing, undo/redo and exact path persistence after reload. Chromium additionally compares low/high pen pressure: Ball widths match, Brush varies more than Fountain, and firm Pencil strokes have greater opacity. Picker checks cover both themes, reduced motion, keyboard selection and Escape focus restoration, four phone/tablet orientations, reachable 44px controls and the existing 360px by 54px toolbar limit. Brush taper is bounded by stroke length so pen taps remain visible. All scenarios record video.

Vite excludes Playwright artifacts from file watching so generated trace HTML and reports cannot reload the app during another test.

The handwriting config uses a 60-second scenario timeout and no retries. Its managed development server sets `WRITEME_E2E=true` to disable file watching, so concurrent workspace edits cannot interrupt a scenario. Set the same variable when starting an external development server for these tests.

Production safeguards cover concurrent browser tabs, compare-and-set persistence, failed-save recovery downloads, navigation while saving, readable white ink on dark paper, preservation of extension fields, unsupported schemas and unsafe coordinates. Sparse imported strokes are tested with lengths up to one trillion canvas units; erasing runs in proportion to the number of points rather than segment length.

The production suite uses the built PWA without importing application internals. It checks ink, paper settings, undo/redo and reload persistence across all seven profiles. Lifecycle scenarios additionally verify distinct ink on multiple pages, sticky note navigation, portrait/landscape toolbar bounds and 44px targets, returning from another browser tab, and closing and restarting the browser with the same profile. Chromium also verifies that lost pointer capture discards an interrupted stroke and the next pen stroke saves correctly. Browser restart videos from both sessions are attached to the report. These browser lifecycle checks do not simulate operating-system suspension.

Chromium checks actual browser offline mode. WebKit checks an unavailable app server through an isolated localhost proxy: Playwright 1.62.1's WebKit offline emulation rejects service-worker navigation, matching [the upstream issue](https://github.com/microsoft/playwright/issues/42775). This server-outage check verifies the cached app shell and continued IndexedDB writes, but does not replace a physical Safari offline check.

The native suite checks both the compiled Electron renderer and the actual packaged application with isolated temporary user profiles. Each scenario verifies SQLite persistence across renderer reload and application restart and records both launches. The packaged test uses Playwright's Chromium transport with the packaged executable, preserving its production fuses: [Playwright's Electron launcher requires Node inspection](https://playwright.dev/docs/api/class-electron), which the production package disables. Installer installation, notarization and operating-system prompts still require separate release validation.

The handwriting workflow checks types, feature lint, development scenarios, production PWA behavior and compiled and packaged Electron persistence on native macOS, Linux and Windows runners. The release workflow depends on this gate and additionally runs the packaged test against each release build before staging its artifacts. Reports and videos are retained even when this check fails. Release downloads select only the three application artifact names so test videos are not published as application downloads.

Set `WRITEME_PACKAGED_EXECUTABLE` to test a specific executable, including one extracted from a release archive. Otherwise the native suite uses `out/writeme-<platform>-<architecture>/`. `PLAYWRIGHT_ARTIFACT_DIR` also works in the native config; its JSON report records the actual host OS and architecture.

To select one profile:

```sh
npm run test:e2e:handwriting -- --project ipad
```

To target an already running app, set `PLAYWRIGHT_BASE_URL`. To isolate artifacts, set `PLAYWRIGHT_ARTIFACT_DIR`. These environment variables work in the device config without changing the default test suite.

For an external dev server, use HTTPS or forward it through localhost inside the browser runner. A Docker browser visiting `http://host.docker.internal` does not get a secure context, so the text editor's `crypto.randomUUID` call fails when following a note link. A localhost TCP proxy preserves the normal development origin without changing browser security settings.

The separate `npm run test:e2e:handwriting:device` command runs on a connected physical Android device. It does not participate in emulated CI and fails instead of skipping when prerequisites are absent. An operator draws two strokes with a real pen; the test measures trusted pen events and pressure variation, checks saved ink after reload and Chrome restart, and records both sessions. See [device setup and iPad/Android acceptance scenarios](./handwriting-device-checks.md) for commands and the remaining hardware checks.
