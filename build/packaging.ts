import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BuildProfile } from "./profiles.mts";

export function runtimePathsForProfile(profile: BuildProfile): string[] {
    return [
        "public",
        "node_modules/better-sqlite3",
        ...(profile.features.cli ? ["packages/cli/dist"] : []),
        ...(profile.features.terminal ? ["node_modules/node-pty"] : []),
    ];
}

export function assertPackagePlatform(profile: BuildProfile, platform: string): void {
    const expected =
        profile.os === "macos"
            ? profile.channel === "app-store"
                ? "mas"
                : "darwin"
            : profile.os === "windows"
              ? "win32"
              : "linux";
    if (platform !== expected)
        throw new Error(
            `Build profile ${profile.os}/${profile.channel} requires packaging platform ${expected}, received ${platform}.`,
        );
}

export async function assertCompiledProfiles(profile: BuildProfile, buildPath: string): Promise<void> {
    for (const file of [
        ".vite/build/writeme-build-main.json",
        ".vite/build/writeme-build-preload.json",
        ".vite/renderer/main_window/writeme-build-renderer.json",
    ]) {
        const manifest = JSON.parse(await readFile(path.join(buildPath, file), "utf8")) as unknown;
        if (
            !manifest ||
            typeof manifest !== "object" ||
            !("os" in manifest) ||
            !("channel" in manifest) ||
            !("features" in manifest) ||
            manifest.os !== profile.os ||
            manifest.channel !== profile.channel ||
            JSON.stringify(manifest.features) !== JSON.stringify(profile.features)
        ) {
            throw new Error(
                `Compiled capability profile mismatch in ${file}. Rebuild all surfaces with the selected profile.`,
            );
        }
    }
}
