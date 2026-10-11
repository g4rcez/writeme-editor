# Physical handwriting checks

Use a test notebook and a dedicated test device. Record the app revision, OS version, browser version, device model and pen model with each result. Record a screen video that shows the actions and their results; a desktop device profile is not physical-device evidence.

## Connected Android pen test

Install Android platform tools, enable USB debugging, authorize the computer and start ADB. Install current Chrome and enable its `chrome://flags/#enable-command-line-on-non-rooted-devices` flag. Playwright's [Android API](https://playwright.dev/docs/api/class-android) controls Chrome through an authenticated ADB connection.

Serve the built app on a dedicated localhost port. This keeps test notes away from the origin used for personal notes. Use a fresh port/origin when repeating the test because Chrome retains the previous test notebook. The runner restarts Chrome, so finish other work on the device first.

In one terminal:

```sh
npm run browser:build
npm exec vite -- preview --host 127.0.0.1 --port 5182 --strictPort
```

In another terminal:

```sh
adb start-server
adb devices
adb reverse tcp:5182 tcp:5182
PLAYWRIGHT_DEVICE_BASE_URL=http://localhost:5182 npm run test:e2e:handwriting:device
```

If several devices are attached, select one with `PLAYWRIGHT_ANDROID_SERIAL`. With that selection, use `adb -s "$PLAYWRIGHT_ANDROID_SERIAL" reverse tcp:5182 tcp:5182`. On PowerShell set `$env:PLAYWRIGHT_DEVICE_BASE_URL = "http://localhost:5182"` before the npm command. An HTTPS test deployment can be used instead of the localhost server and forwarding.

When the runner prints its instruction, draw exactly two separate strokes with the physical pen on the open canvas. Vary pressure from light to firm and keep fingers away for this measured step. It requires trusted `pointerType=pen` events, two completed strokes, pressure variation greater than 0.1, three saved strokes including the automated setup stroke, and identical saved paths after Chrome restarts. No synthetic pen input is sent in the measured step. The runner rejects Android emulators and never falls back to a desktop browser.

Reports, device metadata, measured pen events, screenshots and videos from both launches are saved in `artifacts/playwright/handwriting-device/`. The serial number is not included in the report. Override this location with `PLAYWRIGHT_ARTIFACT_DIR`.

```sh
npm exec playwright -- show-report artifacts/playwright/handwriting-device/report
adb reverse --remove tcp:5182
```

This test measures physical pen pressure and persistence. Palm rejection, operating-system suspension, physical rotation and native color pickers still require the scenarios below.

## iPad and Android operator scenarios

Run every scenario on an iPad with Apple Pencil and an Android tablet with its supported pen. For iPad, use Safari and an installed Home Screen PWA from an HTTPS test deployment. Use the built app, not a development server. Enable the device's screen recorder before creating the notebook. Record failures as failures and keep the video.

| Case                       | Actions                                                                                                                                                                                                                       | Required result                                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Physical pressure and palm | Create a handwritten note. Draw light and firm strokes, then write while resting the palm on the display. Lift the pen and write again.                                                                                       | Pressure visibly changes stroke width. Palm contact creates no stray ink, scroll or zoom. The next stroke works after palm contact.     |
| Gesture modes              | With finger drawing disabled, pan and pinch with fingers. Enable finger drawing in Notebook options and draw with a finger. Disable it again and pan. Undo and redo the finger stroke.                                        | Pen ink remains intact. Fingers pan/zoom in navigation mode and create ink only in drawing mode. Undo/redo affects the intended stroke. |
| Physical rotation          | Add a second page with different ink. Set grid paper, a custom paper color and spacing. Add a sticky link to another note on page one. Rotate the device both ways with each options panel open, then close it.               | Controls remain reachable without clipping. Ink and paper persist on both pages. The link stays on page one and opens the correct note. |
| OS suspension              | Wait for Saved. Switch to another app, lock the device, unlock and return. Continue writing, wait for Saved, then close and reopen the app.                                                                                   | Both pages, paper settings and the sticky link remain intact. New pen input works after returning.                                      |
| Offline restart            | While online, open both the notebook and its linked note, then return and wait for Saved. Enable airplane mode, close and reopen the Home Screen app, add ink and wait for Saved. Reopen again while offline, then reconnect. | Cached notes open offline. New ink survives the second restart and reconnect. No older snapshot replaces it.                            |
| Native color picker        | Open Notebook options and the native paper-color picker. Select a color, confirm, draw and reload. Repeat by canceling the native picker.                                                                                     | Confirmed color survives reload; canceled selection keeps the previous color. Touch and pen input work after the picker closes.         |
| Pen interruption           | Begin a stroke and interrupt it with an OS gesture or app switch. Return, lift the pen and draw a new stroke.                                                                                                                 | No stuck preview or unintended ink remains. The next stroke saves and survives reopening.                                               |

For each device, save a record beside the video:

```text
App revision (include dirty-source hashes if applicable):
Device / OS / browser / pen:
Execution date / operator:
Pressure and palm: PASS or FAIL; video timestamp:
Gesture modes: PASS or FAIL; video timestamp:
Physical rotation: PASS or FAIL; video timestamp:
OS suspension: PASS or FAIL; video timestamp:
Offline restart: PASS or FAIL; video timestamp:
Native color picker: PASS or FAIL; video timestamp:
Pen interruption: PASS or FAIL; video timestamp:
Failure details and reproduction:
Video path:
Android Playwright report path (when run):
```

Do not mark hardware sign-off complete without the recorded results. The automated browser lifecycle suite supplies additional regression coverage; its viewport changes and browser restart do not establish these physical operating-system behaviors.
