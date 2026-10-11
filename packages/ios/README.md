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

For a device or App Store archive, open Xcode, choose your signing team and final bundle identifier in the App target, then select a device or archive destination. The simulator build does not provide an installable iPhone release. Increment the build number before uploading a new version.

`App/PrivacyInfo.xcprivacy` declares the filesystem timestamp access used for file exports. No microphone permission or AI service is configured. Update privacy declarations when adding new native capabilities.
