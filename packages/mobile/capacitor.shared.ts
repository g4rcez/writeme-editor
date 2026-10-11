import type { CapacitorConfig } from "@capacitor/cli";

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
    plugins: { Keyboard: { resize: "native", resizeOnFullScreen: true } },
} satisfies CapacitorConfig;
