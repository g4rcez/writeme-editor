import type { CapacitorConfig } from "@capacitor/cli";
import type { KeyboardResize } from "@capacitor/keyboard";

export const mobileConfig = {
    appId: "dev.writeme.app",
    appName: "Writeme",
    webDir: "../mobile/dist",
    includePlugins: [
        "@capacitor/app",
        "@capacitor/browser",
        "@capacitor/filesystem",
        "@capacitor/keyboard",
        "@capacitor/share",
        "@capacitor/status-bar",
    ],
    server: { hostname: "localhost", androidScheme: "https" },
    ios: { path: "native", contentInset: "never", preferredContentMode: "mobile" },
    android: { path: "native", allowMixedContent: false },
    // "native" resizes the web view itself, so a bottom-anchored toolbar sits on top of the keyboard.
    plugins: { Keyboard: { resize: "native" as KeyboardResize, resizeOnFullScreen: true } },
} satisfies CapacitorConfig;
