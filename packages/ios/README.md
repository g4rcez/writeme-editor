# Writeme iOS

Capacitor iOS shell for the shared [mobile editor](../mobile/README.md).

Requirements: macOS, Xcode 26 or newer with command-line tools selected and an iOS simulator runtime, Node.js 24, and npm. The deployment target is iOS 15. Swift Package Manager resolves Capacitor and plugin dependencies; CocoaPods is not required.

From the repository root:

```sh
npm run ios:sync
npm run ios:open
npm run ios:run
npm run ios:build
```

The project is `native/App/App.xcodeproj`, scheme `App`. `ios:build` creates an unsigned simulator application at `packages/ios/build/Build/Products/Debug-iphonesimulator/App.app`.

## Run on your own iPhone (no App Store)

A free Apple ID is enough. Do the first two steps once:

1. Xcode > Settings > Accounts > add your Apple ID. On the iPhone, turn on Settings > Privacy & Security > Developer Mode (it restarts once).
2. Find your 10-character Team ID: Xcode > Settings > Accounts > your team, or the Signing & Capabilities tab of the App target.
3. Plug the phone in, unlock it and tap Trust, then:

```sh
WRITEME_IOS_TEAM=ABCDE12345 npm run ios:device:check   # validates team, bundle ID and device; builds nothing
WRITEME_IOS_TEAM=ABCDE12345 npm run ios:device         # sync assets, build a signed Debug app, install and launch it
```

Notes:

- The app installs as `dev.writeme.app.local`, deliberately not `dev.writeme.app`. A development team that registers the store identifier can block your paid account from claiming it later, so the script refuses it unless `WRITEME_IOS_ALLOW_STORE_BUNDLE_ID=1`. Override the default with `WRITEME_IOS_BUNDLE_ID`.
- Set `WRITEME_IOS_DEVICE` (name or UDID) when more than one phone is connected.
- Free-account builds stop launching after 7 days; run the command again to refresh. The first launch may ask you to trust your Apple ID under Settings > General > VPN & Device Management.
- The on-device app has its own storage. Export a library backup (Settings > Backup) before replacing it with a build that uses a different identifier.
- Debug builds enable Safari's Web Inspector: Safari > Develop > your iPhone > Writeme (turn on Settings > Safari > Advanced > Web Inspector on the phone).

For a device or App Store archive, open Xcode, choose your signing team and final bundle identifier in the App target, then select a device or archive destination. The simulator build does not provide an installable iPhone release. Increment the build number before uploading a new version.

`App/PrivacyInfo.xcprivacy` declares the filesystem timestamp access used for file exports. No microphone permission or AI service is configured. Update privacy declarations when adding new native capabilities.
