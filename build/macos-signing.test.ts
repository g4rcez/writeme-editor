import { describe, expect, it } from "vitest";
import { resolveMacSigning } from "./macos-signing.ts";

type Options = { hardenedRuntime?: boolean; timestamp?: string };

function appOptions(env: NodeJS.ProcessEnv): Options {
    const { osxSign } = resolveMacSigning(env);
    if (!osxSign.optionsForFile) {
        throw new Error("Missing signing options");
    }
    return osxSign.optionsForFile("/out/writeme.app") as Options;
}

describe("macOS signing", () => {
    it("signs a local build with the hardened runtime, without Apple's timestamp server or notarization", () => {
        const env = { APPLE_SIGNING_IDENTITY: "ABCDEF" };

        expect(appOptions(env)).toMatchObject({ hardenedRuntime: true, timestamp: "none" });
        expect(resolveMacSigning(env).osxNotarize).toBeUndefined();
    });

    it("refuses to notarize an ad-hoc signature", () => {
        expect(() => resolveMacSigning({ APPLE_SIGNING_IDENTITY: "-", WRITEME_NOTARY_PROFILE: "profile" })).toThrow(
            /Developer ID/,
        );
    });
});
