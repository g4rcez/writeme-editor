import { afterEach, describe, expect, it, vi } from "vitest";
import { assertPackagePlatform, runtimePathsForProfile } from "./packaging";
import {
    BUILD_PROFILES,
    desktopProfile,
    FEATURE_NAMES,
    mobileProfile,
    profileFromEnvironment,
    resolveBuildProfile,
} from "./profiles.mts";

afterEach(() => vi.unstubAllEnvs());

describe("immutable distribution profiles", () => {
    it.each(["macos-direct", "macos-homebrew", "windows-direct", "linux-direct", "linux-homebrew"])(
        "preserves every desktop capability in %s",
        (name) => {
            const profile = resolveBuildProfile(name);
            expect(FEATURE_NAMES.every((feature) => profile.features[feature])).toBe(true);
            expect(runtimePathsForProfile(profile)).toContain("packages/cli/dist");
            expect(runtimePathsForProfile(profile)).toContain("node_modules/node-pty");
        },
    );
    it.each(["macos-app-store", "ios-app-store", "android-google-play"])(
        "hard-blocks restricted capabilities in %s",
        (name) => {
            const profile = resolveBuildProfile(name);
            expect(Object.values(profile.features).every((enabled) => !enabled)).toBe(true);
            expect(Object.isFrozen(profile)).toBe(true);
            expect(Object.isFrozen(profile.features)).toBe(true);
            expect(runtimePathsForProfile(profile)).not.toContain("packages/cli/dist");
            expect(runtimePathsForProfile(profile)).not.toContain("node_modules/node-pty");
        },
    );
    it("allows only narrower capability overrides", () => {
        expect(resolveBuildProfile("macos-direct", "vimScripts").features.vimScripts).toBe(false);
        expect(resolveBuildProfile("macos-app-store").features.vimScripts).toBe(false);
        expect(resolveBuildProfile("macos-direct", "terminal, localProxy").features).toMatchObject({
            terminal: false,
            ai: false,
            meetingNotes: false,
            cli: true,
        });
        expect(() => resolveBuildProfile("macos-app-store", "unknown")).toThrow("Unknown disabled feature");
        vi.stubEnv("WRITEME_ENABLE_FEATURES", "terminal");
        expect(() => profileFromEnvironment("macos-app-store")).toThrow("cannot be enabled");
    });
    it("rejects invalid profiles and build surfaces", () => {
        for (const name of ["", "ios-homebrew", "macos-google-play", "typo", "__proto__"])
            expect(() => resolveBuildProfile(name)).toThrow("Unknown Writeme build profile");
        vi.stubEnv("WRITEME_BUILD_PROFILE", "ios-app-store");
        expect(() => desktopProfile()).toThrow("desktop");
        vi.stubEnv("WRITEME_BUILD_PROFILE", "macos-direct");
        expect(() => mobileProfile()).toThrow("iOS or Android");
        expect(Object.keys(BUILD_PROFILES)).toContain("android-direct");
    });
    it("requires the MAS Electron runtime for the Mac App Store", () => {
        const profile = resolveBuildProfile("macos-app-store");
        expect(() => assertPackagePlatform(profile, "darwin")).toThrow("requires packaging platform mas");
        expect(() => assertPackagePlatform(profile, "mas")).not.toThrow();
        expect(() => assertPackagePlatform(resolveBuildProfile("macos-direct"), "mas")).toThrow(
            "requires packaging platform darwin",
        );
    });
});
