import type { BuildProfile, FeatureName } from "../../../../build/profiles.mts";

declare const __WRITEME_BUILD__: BuildProfile;

const developmentFeatures = {
    ai: true,
    cli: true,
    git: true,
    terminal: true,
    autoUpdate: true,
    localProxy: true,
    vimScripts: true,
    meetingNotes: true,
    codeExecution: true,
    multiInstance: true,
    templateScripts: true,
} as const;

export const BUILD: BuildProfile = Object.freeze(
    // The bundler injects __WRITEME_BUILD__ via define. Outside a build (vitest, dev) it does not exist, and a bare read throws a ReferenceError.
    // oxlint-disable-next-line unicorn/no-typeof-undefined
    typeof __WRITEME_BUILD__ === "undefined"
        ? { os: "web", channel: "direct", features: developmentFeatures }
        : { ...__WRITEME_BUILD__, features: Object.freeze(__WRITEME_BUILD__.features) },
);

export const FEATURES = BUILD.features;

export function requireFeature(feature: FeatureName): void {
    if (!FEATURES[feature]) {throw new Error(`Feature ${feature} is unavailable in this build.`);}
}
