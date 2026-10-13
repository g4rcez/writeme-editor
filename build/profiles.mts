export const FEATURE_NAMES = [
    "ai",
    "terminal",
    "codeExecution",
    "templateScripts",
    "vimScripts",
    "git",
    "cli",
    "meetingNotes",
    "localProxy",
    "autoUpdate",
    "multiInstance",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];
export type BuildOS = "macos" | "windows" | "linux" | "ios" | "android" | "web";
export type InstallChannel = "direct" | "homebrew" | "app-store" | "google-play";
export type BuildProfile = Readonly<{
    os: BuildOS;
    channel: InstallChannel;
    features: Readonly<Record<FeatureName, boolean>>;
}>;

export const BUILD_PROFILES = {
    "macos-direct": { os: "macos", channel: "direct" },
    "macos-homebrew": { os: "macos", channel: "homebrew" },
    "macos-app-store": { os: "macos", channel: "app-store" },
    "windows-direct": { os: "windows", channel: "direct" },
    "linux-direct": { os: "linux", channel: "direct" },
    "linux-homebrew": { os: "linux", channel: "homebrew" },
    "ios-direct": { os: "ios", channel: "direct" },
    "ios-app-store": { os: "ios", channel: "app-store" },
    "android-direct": { os: "android", channel: "direct" },
    "android-google-play": { os: "android", channel: "google-play" },
    "web-direct": { os: "web", channel: "direct" },
} as const satisfies Record<string, { os: BuildOS; channel: InstallChannel }>;

export type BuildProfileName = keyof typeof BUILD_PROFILES;

export function isStoreProfile(profile: Pick<BuildProfile, "channel">): boolean {
    return profile.channel === "app-store" || profile.channel === "google-play";
}

export function resolveBuildProfile(name: string, disabled = ""): BuildProfile {
    if (!Object.hasOwn(BUILD_PROFILES, name)) throw new Error(`Unknown Writeme build profile: ${name}`);
    const target = BUILD_PROFILES[name as BuildProfileName];
    const desktop = ["macos", "windows", "linux"].includes(target.os);
    const mobile = target.os === "ios" || target.os === "android";
    const store = isStoreProfile(target);
    const features: Record<FeatureName, boolean> = {
        ai: !store && !mobile,
        terminal: !store && !mobile,
        codeExecution: !store && !mobile,
        templateScripts: !store,
        vimScripts: !store && !mobile,
        git: !store && desktop,
        cli: !store && desktop,
        meetingNotes: !store && !mobile,
        localProxy: !store && !mobile,
        autoUpdate: !store && !mobile,
        multiInstance: !store && desktop,
    };
    for (const feature of disabled
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)) {
        if (!FEATURE_NAMES.includes(feature as FeatureName)) throw new Error(`Unknown disabled feature: ${feature}`);
        features[feature as FeatureName] = false;
    }
    if (!features.localProxy) features.ai = features.meetingNotes = false;
    return Object.freeze({ ...target, features: Object.freeze(features) });
}

export function profileFromEnvironment(defaultName: BuildProfileName): BuildProfile {
    if (process.env.WRITEME_ENABLE_FEATURES) {
        throw new Error(
            "Features cannot be enabled through environment overrides. Select a direct or Homebrew profile.",
        );
    }
    return resolveBuildProfile(process.env.WRITEME_BUILD_PROFILE ?? defaultName, process.env.WRITEME_DISABLE_FEATURES);
}

export function desktopProfile(): BuildProfile {
    const fallback =
        process.platform === "darwin"
            ? "macos-direct"
            : process.platform === "win32"
              ? "windows-direct"
              : "linux-direct";
    const profile = profileFromEnvironment(fallback);
    if (!["macos", "windows", "linux"].includes(profile.os))
        throw new Error("Electron requires a desktop build profile.");
    return profile;
}

export function mobileProfile(): BuildProfile {
    const profile = profileFromEnvironment("android-google-play");
    if (profile.os !== "ios" && profile.os !== "android")
        throw new Error("Capacitor requires an iOS or Android build profile.");
    return profile;
}

export function webProfile(): BuildProfile {
    const profile = profileFromEnvironment("web-direct");
    if (profile.os !== "web") throw new Error("The PWA build requires a web profile.");
    return profile;
}
