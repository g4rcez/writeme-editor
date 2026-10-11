# Writeme Android

Capacitor Android shell for the shared [mobile editor](../mobile/README.md).

Requirements: Android Studio, Android SDK 36, Node.js 24, npm, and a Java runtime from 21 through 24. Android 7 (API 24) is the minimum supported version. Install the SDK through Android Studio and set `ANDROID_HOME` if it is outside the usual user SDK directory.

The build helper checks `JAVA_HOME`, Android Studio's bundled runtime, and installed mise Java runtimes. Set `JAVA_HOME` explicitly for other installations. A Java 25 runtime is incompatible with the generated Gradle version. Gradle's Foojay resolver provisions the Java 21 plugin toolchain if necessary; first builds need network access.

From the repository root:

```sh
npm run android:sync
npm run android:open
npm run android:run
npm run android:build
```

Android Studio opens `native`. The debug APK is `packages/android/native/app/build/outputs/apk/debug/app-debug.apk`. Install it on an emulator or device using Android Studio or `adb install -r packages/android/native/app/build/outputs/apk/debug/app-debug.apk`.

For Play Store distribution, set the final `applicationId`, increment `versionCode` in `native/app/build.gradle`, and generate a signed Android App Bundle in Android Studio. Keep signing credentials outside source control. `android:build` produces a debug APK, not a signed Play Store release.

The native share sheet uses FileProvider access to the application's cache. The app does not request broad storage or microphone permissions.
