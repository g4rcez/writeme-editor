import type { BuildProfile, FeatureName } from "../../../../build/profiles.mts";

declare const __WRITEME_BUILD__: BuildProfile;

const developmentFeatures = {
    ai: true,
    terminal: true,
    codeExecution: true,
    templateScripts: true,
    git: true,
    cli: true,
    meetingNotes: true,
    localProxy: true,
    autoUpdate: true,
    multiInstance: true,
} as const;

export const BUILD: BuildProfile = Object.freeze(
    typeof __WRITEME_BUILD__ === "undefined"
        ? { os: "web", channel: "direct", features: developmentFeatures }
        : { ...__WRITEME_BUILD__, features: Object.freeze(__WRITEME_BUILD__.features) },
);

export const FEATURES = BUILD.features;

export function requireFeature(feature: FeatureName): void {
    if (!FEATURES[feature]) throw new Error(`Feature ${feature} is unavailable in this build.`);
}
