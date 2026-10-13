import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { PublisherGithub } from "@electron-forge/publisher-github";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import fs from "node:fs/promises";
import path from "node:path";
import { assertCompiledProfiles, assertPackagePlatform, runtimePathsForProfile } from "./build/packaging.ts";
import { desktopProfile, isStoreProfile } from "./build/profiles.mts";

const buildProfile = desktopProfile();
const storeBuild = isStoreProfile(buildProfile);

const appleId = process.env.APPLE_ID;
const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
const appleTeamId = process.env.APPLE_TEAM_ID;
const appleSigningIdentity = process.env.APPLE_SIGNING_IDENTITY;
const hasAppleNotarizeCredentials = Boolean(appleId && appleIdPassword && appleTeamId);
const osxNotarize = hasAppleNotarizeCredentials
    ? {
          appleId: appleId as string,
          appleIdPassword: appleIdPassword as string,
          teamId: appleTeamId as string,
      }
    : undefined;
const osxSign = hasAppleNotarizeCredentials
    ? {
          ...(appleSigningIdentity ? { identity: appleSigningIdentity } : {}),
          continueOnError: false,
      }
    : {
          identity: "-",
          identityValidation: false,
          preAutoEntitlements: false,
          continueOnError: false,
          optionsForFile: (): { entitlements: string[]; hardenedRuntime: boolean; timestamp: string } => ({
              entitlements: [],
              // Ad-hoc signatures have no team ID for library validation.
              hardenedRuntime: false,
              timestamp: "none",
          }),
      };

const runtimePaths = runtimePathsForProfile(buildProfile);

async function copyRuntimePaths(buildPath: string): Promise<void> {
    await Promise.all(
        runtimePaths.map((runtimePath) =>
            fs.cp(path.resolve(import.meta.dirname, runtimePath), path.resolve(buildPath, runtimePath), {
                recursive: true,
            }),
        ),
    );
}

const config: ForgeConfig = {
    packagerConfig: {
        asar: buildProfile.features.cli ? { unpack: "packages/cli/dist/**" } : true,
        name: "writeme",
        executableName: "writeme",
        appBundleId: "dev.writeme.app",
        icon: "./public/icon",
        extendInfo: {
            ...(buildProfile.features.meetingNotes
                ? {
                      NSMicrophoneUsageDescription: "Writeme uses your microphone to transcribe meeting notes.",
                      NSAudioCaptureUsageDescription:
                          "Writeme captures meeting audio to transcribe it into your notes.",
                  }
                : {}),
            NSDocumentsFolderUsageDescription:
                "Writeme needs access to the Documents folder to open and save your notes.",
        },
        osxSign: storeBuild
            ? {
                  identity: process.env.APPLE_MAS_SIGNING_IDENTITY,
                  provisioningProfile: process.env.APPLE_MAS_PROVISIONING_PROFILE,
                  optionsForFile: (filePath: string) => ({
                      entitlements: path.resolve(
                          import.meta.dirname,
                          filePath.endsWith(".app") && !filePath.includes("/Frameworks/")
                              ? "build/entitlements.mas.plist"
                              : "build/entitlements.mas.inherit.plist",
                      ),
                      hardenedRuntime: false,
                  }),
              }
            : osxSign,
        ...(!storeBuild && osxNotarize ? { osxNotarize } : {}),
    },
    rebuildConfig: {},
    hooks: {
        prePackage: async (_config, platform) => {
            assertPackagePlatform(buildProfile, platform);
            if (
                storeBuild &&
                (!process.env.APPLE_MAS_SIGNING_IDENTITY || !process.env.APPLE_MAS_PROVISIONING_PROFILE)
            ) {
                throw new Error(
                    "Mac App Store packaging requires APPLE_MAS_SIGNING_IDENTITY and APPLE_MAS_PROVISIONING_PROFILE; ad-hoc signing is forbidden.",
                );
            }
        },
        preMake: async () => {
            if (storeBuild)
                throw new Error("Store profiles require store packaging; direct installer makers are disabled.");
        },
        packageAfterCopy: async (_config, buildPath) => {
            await assertCompiledProfiles(buildProfile, buildPath);
            if (!buildProfile.features.cli)
                await fs.rm(path.join(buildPath, "packages/cli"), { recursive: true, force: true });
            if (!buildProfile.features.terminal)
                await fs.rm(path.join(buildPath, "node_modules/node-pty"), { recursive: true, force: true });
            await copyRuntimePaths(buildPath);
            await fs.writeFile(path.join(buildPath, "writeme-build.json"), JSON.stringify(buildProfile, null, 2));
        },
    },
    makers: [
        new MakerSquirrel({
            name: "writeme",
            setupExe: "writeme-setup.exe",
            setupIcon: "./public/icon.ico",
            description: "Writeme - Markdown editor",
        }),
        new MakerDMG(
            {
                format: "ULFO",
                name: "writeme",
                icon: "./public/icon.icns",
                background: "./public/dmg-background.png",
                iconSize: 88,
                contents: ({ appPath }) => [
                    { x: 179, y: 257, type: "file", path: appPath },
                    { x: 485, y: 257, type: "link", path: "/Applications" },
                ],
                additionalDMGOptions: {
                    window: { size: { width: 658, height: 498 } },
                },
            },
            ["darwin"],
        ),
        new MakerZIP({}, ["darwin", "linux", "win32"]),
        new MakerDeb({
            options: {
                name: "writeme",
                productName: "Writeme",
                description: "Writeme - Markdown editor",
                maintainer: "g4rcez",
                homepage: "https://writeme.dev",
                categories: ["Utility"],
            },
        }),
        new MakerRpm({
            options: {
                name: "writeme",
                productName: "Writeme",
                description: "Writeme - Markdown editor",
                homepage: "https://writeme.dev",
            },
        }),
    ],
    publishers: storeBuild
        ? []
        : [
              new PublisherGithub({
                  repository: { owner: "g4rcez", name: "writeme-editor" },
                  prerelease: false,
                  generateReleaseNotes: true,
              }),
          ],
    plugins: [
        new AutoUnpackNativesPlugin({}),
        new VitePlugin({
            // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
            // If you are familiar with Vite configuration, it will look really familiar.
            build: [
                {
                    // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
                    entry: "packages/editor/src/main.ts",
                    config: "vite.main.config.mts",
                    target: "main",
                },
                {
                    entry: "packages/editor/src/preload.ts",
                    config: "vite.preload.config.mts",
                    target: "preload",
                },
            ],
            renderer: [
                {
                    name: "main_window",
                    config: "vite.renderer.config.mts",
                },
            ],
        }),
        // Fuses are used to enable/disable various Electron functionality
        // at package time, before code signing the application
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
};

export default config;
