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
    : undefined;

const runtimePaths = [
    "public",
    "packages/cli/dist",
    "node_modules/better-sqlite3",
    "node_modules/bindings",
    "node_modules/file-uri-to-path",
    "node_modules/node-pty",
    "node_modules/node-addon-api",
];

async function copyRuntimePaths(buildPath: string): Promise<void> {
    await Promise.all(
        runtimePaths.map((runtimePath) =>
            fs.cp(path.resolve(__dirname, runtimePath), path.resolve(buildPath, runtimePath), {
                recursive: true,
            }),
        ),
    );
}

const config: ForgeConfig = {
    packagerConfig: {
        asar: { unpack: "packages/cli/dist/**" },
        name: "writeme",
        executableName: "writeme",
        appBundleId: "dev.writeme.app",
        icon: "./public/icon",
        ...(osxSign ? { osxSign } : {}),
        ...(osxNotarize ? { osxNotarize } : {}),
    },
    rebuildConfig: {},
    hooks: {
        packageAfterCopy: async (_config, buildPath) => {
            await copyRuntimePaths(buildPath);
        },
    },
    makers: [
        new MakerSquirrel({
            name: "writeme",
            setupExe: "writeme-setup.exe",
            description: "Writeme - Markdown editor",
        }),
        new MakerDMG(
            {
                format: "ULFO",
                name: "writeme",
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
    publishers: [
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
                    entry: "src/main.ts",
                    config: "vite.main.config.ts",
                    target: "main",
                },
                {
                    entry: "src/preload.ts",
                    config: "vite.preload.config.ts",
                    target: "preload",
                },
            ],
            renderer: [
                {
                    name: "main_window",
                    config: "vite.renderer.config.ts",
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
