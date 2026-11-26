import type { ForgePackagerOptions } from "@electron-forge/shared-types";
import { execFileSync } from "node:child_process";
import path from "node:path";

// `continueOnError` is an option of @electron/packager that its signing types leave out. Without `false`, a failed
// signature only prints a warning.
type OsxSign = Exclude<ForgePackagerOptions["osxSign"], boolean | undefined> & { continueOnError: boolean };
type MacSigning = { osxSign: OsxSign; osxNotarize?: ForgePackagerOptions["osxNotarize"] };

const root = path.resolve(import.meta.dirname, "..");

function discoverIdentity(): string {
    if (process.platform !== "darwin") {
        return "";
    }
    return execFileSync(path.join(root, "scripts/signing-identity.sh"), { encoding: "utf8" }).trim();
}

/**
 * Signing of the direct (not Mac App Store) builds.
 *
 * - `APPLE_SIGNING_IDENTITY` picks the certificate, and `-` asks for an ad-hoc signature. Without it,
 *   `scripts/signing-identity.sh` picks one from the keychain.
 * - `WRITEME_NOTARY_PROFILE` names a `notarytool` keychain profile: the build is notarized (a release).
 */
export function resolveMacSigning(env: NodeJS.ProcessEnv = process.env): MacSigning {
    const identity = env.APPLE_SIGNING_IDENTITY || discoverIdentity() || "-";
    const keychainProfile = env.WRITEME_NOTARY_PROFILE;

    if (identity === "-") {
        if (keychainProfile) {
            throw new Error("Notarization needs a Developer ID certificate, not an ad-hoc signature.");
        }
        return {
            osxSign: {
                identity,
                identityValidation: false,
                preAutoEntitlements: false,
                continueOnError: false,
                optionsForFile: () => ({
                    entitlements: [],
                    // Ad-hoc signatures have no team ID for library validation.
                    hardenedRuntime: false,
                    timestamp: "none",
                }),
            },
        };
    }

    // Only a release asks Apple for a secure timestamp: a local build must also work without the network.
    const timestamp = keychainProfile ? {} : { timestamp: "none" };
    return {
        osxSign: {
            identity,
            preAutoEntitlements: false,
            continueOnError: false,
            optionsForFile: (filePath: string) => {
                const base = { hardenedRuntime: true, ...timestamp };
                if (filePath.includes("/packages/cli/dist/")) {
                    return { ...base, entitlements: path.join(root, "build/entitlements.cli.plist") };
                }
                if (filePath.endsWith("/writeme.app") || filePath.endsWith("/writeme.app/Contents/MacOS/writeme")) {
                    return { ...base, entitlements: path.join(root, "build/entitlements.mac.plist") };
                }
                // The Electron helpers keep the entitlements that @electron/osx-sign picks for each of them.
                return base;
            },
        },
        ...(keychainProfile ? { osxNotarize: { keychainProfile } } : {}),
    };
}
