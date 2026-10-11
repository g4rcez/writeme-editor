import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { assertCompiledProfiles } from "./packaging";
import { resolveBuildProfile } from "./profiles.mts";

it("refuses mixed renderer, preload and main profiles", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "writeme-packaging-profile-"));
    const expected = resolveBuildProfile("macos-app-store");
    try {
        const files = [
            ".vite/build/writeme-build-main.json",
            ".vite/build/writeme-build-preload.json",
            ".vite/renderer/main_window/writeme-build-renderer.json",
        ];
        for (const file of files) {
            await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
            await writeFile(path.join(directory, file), JSON.stringify(expected));
        }
        await expect(assertCompiledProfiles(expected, directory)).resolves.toBeUndefined();
        await writeFile(path.join(directory, files[2]!), JSON.stringify(resolveBuildProfile("macos-direct")));
        await expect(assertCompiledProfiles(expected, directory)).rejects.toThrow("profile mismatch");
        await rm(path.join(directory, files[0]!));
        await expect(assertCompiledProfiles(expected, directory)).rejects.toThrow("ENOENT");
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

it("requires MAS signing and prevents direct installer packaging", () => {
    const result = spawnSync(
        process.execPath,
        [
            "-e",
            `
const assert = require("node:assert/strict");
const config = require("./forge.config.ts").default;
(async () => {
    assert.equal(config.publishers.length, 0);
    assert.equal(config.packagerConfig.osxNotarize, undefined);
    assert.equal(config.packagerConfig.asar, true);
    assert.ok(config.packagerConfig.osxSign.optionsForFile("writeme.app").entitlements.endsWith("entitlements.mas.plist"));
    await assert.rejects(config.hooks.prePackage({}, "darwin", "arm64"), /requires packaging platform mas/);
    await assert.rejects(config.hooks.prePackage({}, "mas", "arm64"), /ad-hoc signing is forbidden/);
    await assert.rejects(config.hooks.preMake({}), /direct installer makers are disabled/);
    process.stdout.write("store-packaging-verified");
})().catch(error => { console.error(error); process.exitCode = 1; });`,
        ],
        {
            cwd: process.cwd(),
            encoding: "utf8",
            timeout: 15_000,
            env: {
                ...process.env,
                WRITEME_BUILD_PROFILE: "macos-app-store",
                WRITEME_ENABLE_FEATURES: "",
                APPLE_MAS_SIGNING_IDENTITY: "",
                APPLE_MAS_PROVISIONING_PROFILE: "",
            },
        },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("store-packaging-verified");
});
