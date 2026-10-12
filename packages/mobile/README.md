# Writeme mobile

The shared React editor runs inside Capacitor on iOS and Android. `packages/mobile` owns the web build, plugins, icons, and shared configuration. `packages/ios` and `packages/android` own their native projects.

## Development

Use Node.js 24 and npm from the repository root:

```sh
npm ci
npm run mobile:dev
npm run mobile:typecheck
npm run typecheck
npm run test:e2e -- --platform android --suite mobile
npm run test:e2e -- --platform ios --suite mobile
```

The development server runs only the mobile web interface; it does not start the desktop AI proxy. Playwright uses the production build in Chromium and WebKit. Install the Playwright browsers with `npm exec -- playwright install chromium webkit` when needed.

## Native commands

```sh
npm run ios:sync
npm run ios:open
npm run ios:run
npm run ios:build

npm run android:sync
npm run android:open
npm run android:run
npm run android:build
```

`sync`, `run`, and `build` rebuild and copy the shared web assets. `open` opens the existing native project. Run `sync` after changing the web interface, dependencies, or Capacitor configuration. Native platform details and prerequisites are in the [iOS](../ios/README.md) and [Android](../android/README.md) packages.

The default application identifier is `dev.writeme.app`, version `1.1.0`. Before distribution, choose the final identifier and update both native projects as well as `capacitor.shared.ts`. Build numbers are maintained separately in the Xcode project and Android `app/build.gradle`.

Regenerate icons and splash screens from `assets/logo.svg` with `npm run mobile:assets`. Commit the generated native assets. Capacitor sync generates plugin wiring and copies `dist`; copied web assets, caches, and local signing files are ignored.

## Mobile behavior

- Notes and PDF attachments are stored locally in IndexedDB. Packaged web assets, fonts, and PDF resources support offline editing. External links and remote content still require a connection.
- The header imports Markdown and exports the current note through the native share sheet. Markdown frontmatter preserves supported note types, including handwritten and Excalidraw notes. PDF export shares the original PDF; annotations are preserved in library backups.
- Settings > Backup exports and restores notes, PDF attachments, drawings, comments, tags, groups, views, scripts, and note history. Device settings, credentials, AI conversations, and terminal sessions are excluded. Restore is atomic and rejects duplicate records instead of overwriting them. Export before uninstalling; there is no automatic desktop/mobile sync.
- Backgrounding flushes pending text autosaves when autosave is enabled. Android Back dismisses common dialogs and the sidebar, returns through navigation history, then minimizes the app. Safe areas, keyboard resizing, bundled fonts, status-bar appearance, and external-link handling are configured for native use.
- AI setup, chats, writing assistance, and meeting transcription are disabled on mobile. Desktop terminals and filesystem workspaces are unavailable; mobile uses its local library and file import/export.

## Verification and distribution

### Pipeline downloads

The `Build Android` and `Build iOS` workflows run on pushes to `main` and can be started manually. Download their `build-android` and `build-ios` artifacts from GitHub Actions. Tagged releases call the same workflows, wait for both builds and their mobile Playwright checks, and publish the files alongside the desktop installers on the [release page](https://github.com/g4rcez/writeme-editor/releases).

| Platform   | Release asset                         | Installation                                                                                                             |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Android    | `writeme-<version>-android-debug.apk` | Installable debug APK for testing; allow installation from the downloader app.                                           |
| iOS/iPadOS | `writeme-<version>-ios-unsigned.ipa`  | Unsigned Release build for physical devices; requires an Apple certificate and provisioning profile before installation. |

The pipeline uses the existing `android-google-play` and `ios-app-store` capability profiles, with AI and other restricted features excluded. It does not publish to Google Play, the App Store, or TestFlight. Release tags must match the root `package.json` version; the native version is set from that package and the build number from the workflow run number.

Android debug signing keys can differ between workflow runs, so updating may require uninstalling the previous app. Export a library backup before uninstalling. The iOS IPA cannot be installed directly from the download, and the macOS Developer ID signing credentials are not used for iOS.

The `mobile` suite on `android` and `ios` covers touch controls, AI exclusion, rich-text and Markdown persistence, offline creation, note/PDF import and export, and backup success/failure in Chromium and WebKit respectively. Each suite builds only the shared mobile assets unless `WRITEME_E2E_PREBUILT=1` is set. Unit tests cover native bridge integration and platform boundaries. See [platform suite selection](../../docs/testing/platform-playwright.md) for root-web drawing checks and build-profile reuse.

Debug APK and unsigned simulator builds can be produced locally. App Store and Play Store releases require your signing credentials and developer accounts. Validate the share sheet, keyboard, background saving, system Back, and stylus input on physical devices before distribution. Browser emulation and simulator compilation do not verify those hardware behaviors.
