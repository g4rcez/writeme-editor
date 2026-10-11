# Build profiles and store restrictions

Writeme's capabilities are selected at build time by operating system and installation channel. Direct desktop and Homebrew builds enable all capabilities. Store builds include the core editor and exclude restricted implementations before bundling; user settings, saved tabs, local storage, and runtime environment variables cannot enable them.

## Profiles

| Profile                        | OS           | Installation       | Capabilities                                           |
| ------------------------------ | ------------ | ------------------ | ------------------------------------------------------ |
| `macos-direct`                 | macOS        | Direct download    | Full desktop                                           |
| `macos-homebrew`               | macOS        | Homebrew           | Full desktop                                           |
| `windows-direct`               | Windows      | Direct download    | Full desktop                                           |
| `linux-direct`                 | Linux        | Direct download    | Full desktop                                           |
| `linux-homebrew`               | Linux        | Homebrew           | Full desktop                                           |
| `macos-app-store`              | macOS        | Mac App Store      | Core notes                                             |
| `ios-app-store`                | iOS/iPadOS   | App Store          | Core notes                                             |
| `android-google-play`          | Android      | Google Play        | Core notes                                             |
| `ios-direct`, `android-direct` | iOS, Android | Direct/development | Existing mobile capabilities; template scripts enabled |
| `web-direct`                   | Browser      | Web/PWA            | Existing web capabilities                              |

Core notes retain Markdown, formatting, syntax highlighting, math calculations, Mermaid/Graphviz diagrams, Excalidraw notes, handwriting, PDFs, templates with ordinary/system variables, and local storage. Existing meeting notes remain readable, while capture/transcription controls are unavailable. Script placeholders in existing templates are preserved instead of executed.

Mobile profiles respect actual mobile capabilities: desktop shells, CLI installation, Git subprocesses, AI, and meeting capture are unsupported even outside stores. Homebrew denotes the app's distribution channel; these commands do not create or publish a Homebrew formula.

## Policy audit

Reviewed against the official policies on 2026-10-11. These are conservative Writeme release decisions, not assertions that every listed capability is categorically prohibited by every store.

| Capability        | Writeme implementation                                                           | Store build decision and reason                                                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `terminal`        | Native PTY and OS shells                                                         | Exclude handlers, UI, and `node-pty`; avoid arbitrary native command execution.                                                                                                                                                                             |
| `codeExecution`   | OS interpreters, JavaScript `eval`, HTML previews, `>>eval`                      | Exclude runnable implementations and routes. Keep syntax highlighting and mathematical expressions. Apple's 2.5.2 restrictions and limited educational exception need separate assessment.                                                                  |
| `templateScripts` | User-provided JavaScript via `Function`                                          | Exclude execution and custom-variable settings. Ordinary template substitution remains available.                                                                                                                                                           |
| `cli`             | Install CLI into shared locations; local socket; CLI AI commands                 | Exclude bundled CLI, installer, socket server, and menu/API entries. Apple 2.4.5(ii)/(iv) require self-contained apps without installing shared code or additional apps.                                                                                    |
| `git`             | Spawn the system Git executable                                                  | Exclude implementation and controls; depends on externally installed tools and shell execution.                                                                                                                                                             |
| `meetingNotes`    | System/microphone capture, network transcription, downloadable Whisper installer | Exclude capture/transcription/installer implementations. Apple 2.4.5(iv), 2.5.14 and 5.1 require dependency and recording/data consent review. Keep existing meeting-note content.                                                                          |
| `ai`              | CLI providers, third-party providers, OAuth and note uploads                     | Exclude providers, authentication, requests, and controls until provider-specific data consent, privacy disclosures and applicable AI policies are reviewed. Apple 5.1.2(i) requires explicit permission before sharing personal data with third-party AI.  |
| `localProxy`      | Local HTTP proxy listener                                                        | Exclude implementation and client. Google prohibits third-party proxy services when they are not the app's primary purpose; Writeme's authenticated local proxy is not automatically such a service, but is unnecessary when AI/transcription are disabled. |
| `autoUpdate`      | `update-electron-app`, GitHub download prompts, web service-worker updates       | Exclude native updater. Apple 2.4.5(vii) and Google Play require updates through their stores. Capacitor builds already omit PWA service workers.                                                                                                           |
| `multiInstance`   | Detached Electron workspace processes                                            | Exclude subprocess implementation. Use an in-process folder window; evaluate sandbox lifecycle on signed MAS builds.                                                                                                                                        |

Sources: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Google Play Device and Network Abuse](https://support.google.com/googleplay/android-developer/answer/9888379?hl=en), [Electron Mac App Store submission guide](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide).

## Building

```sh
npm run build:profile -- macos-homebrew
npm run build:profile -- macos-app-store
npm run build:profile -- ios-app-store
npm run build:profile -- android-google-play
```

The default action generates production assets in `artifacts/build-profiles/<profile>`. Desktop assets use the Electron renderer configuration; mobile assets use Capacitor's renderer configuration. Each output includes `writeme-build-renderer.json` with the OS, channel, resolved flags, and excluded modules.

```sh
npm run build:profile -- macos-homebrew package
npm run build:profile -- macos-app-store package
npm run build:profile -- ios-app-store sync
npm run build:profile -- android-google-play sync
```

`package` builds the desktop application. MAS packaging requires `APPLE_MAS_SIGNING_IDENTITY` and `APPLE_MAS_PROVISIONING_PROFILE`, uses Electron's `mas` target and sandbox entitlements, excludes CLI/PTY runtime files and omits GitHub publishers. It rejects ordinary `darwin` packaging and direct-installer makers for store profiles. Direct and Homebrew packages retain the existing signing/notarization behavior.

`sync` rebuilds the shared mobile asset directory for the selected OS, then checks the generated manifest before copying assets into that native project. Sync fails on an OS, channel, or capability mismatch, avoiding accidental reuse of a different profile's assets. `ios:sync` and `android:sync` select their respective store profiles explicitly. `ios:build` still produces a simulator build, and `android:build` still produces a debug APK; neither uploads to a store. Use Xcode archiving and a signed Android release App Bundle for submission.

Existing `browser:build` defaults to `web-direct`; Electron defaults to the host's direct profile; standalone `mobile:build` defaults to `android-google-play`. Set `WRITEME_BUILD_PROFILE` explicitly for cross-platform builds. `WRITEME_DISABLE_FEATURES=terminal,meetingNotes` narrows a profile. Unknown profiles/features and `WRITEME_ENABLE_FEATURES` are build errors. Disabling the local proxy also disables the current AI and meeting implementations that depend on it.

## Enforcement and verification

`build/profiles.mts` is the capability matrix. `build/feature-plugin.mts` replaces disabled source modules with inert UI or functions that throw; original implementations, imports, downloaded installer scripts, provider clients and native shell dependencies cannot enter the module graph through those modules. New exported symbols are parsed automatically; unsupported export forms fail the build. Core execution helpers are isolated so disabling scripts does not remove template substitution or math. The same fixed profile is injected into renderer, main and preload builds.

The renderer removes commands/settings/routes and filters restored AI/terminal tabs. Global actions reject unavailable capabilities. The main process does not register disabled handlers or start disabled services. The preload does not expose disabled APIs. Packaging removes disabled native files even if they exist locally. Every layer uses the same build constants; there is no runtime flag service.

```sh
npm run test:build-profiles
npm run test:e2e:build-profiles
WRITEME_BUILD_PROFILE=macos-app-store node --import tsx scripts/build-native-profile.ts
npm exec -- playwright test --config playwright.build-profiles-native.config.ts
```

## Submission requirements beyond flags

Feature exclusion does not establish store approval. Signed MAS sandbox behavior, persistent access to user-selected folders, Apple provisioning/application-group entitlements, privacy manifests and store privacy disclosures must be validated on the actual submitted archive. iOS/iPadOS and Android require signed device testing, current SDK/target versions and complete privacy metadata. A public release must not describe features omitted from that profile. AI or meeting capabilities should only be restored in a store profile through a reviewed source change, with new consent/policy/device tests, never via an environment override.
