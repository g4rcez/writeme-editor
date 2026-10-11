import { Capacitor } from "@capacitor/core";
import { FEATURES } from "./build-features";
import { isElectron } from "./is-electron";

export type AppPlatform = "electron" | "web" | "mobile";

export function isMobile(): boolean {
    return import.meta.env.VITE_WRITEME_TARGET === "mobile" || Capacitor.isNativePlatform();
}

export function getAppPlatform(): AppPlatform {
    if (isElectron()) return "electron";
    return isMobile() ? "mobile" : "web";
}

export function supportsAI(): boolean {
    return FEATURES.ai && !isMobile();
}
