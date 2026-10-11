import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Electron Vite config loaders", () => {
    it.each(["main", "preload", "renderer"])("loads %s without native compatibility warnings", (surface) => {
        for (const loader of ["bundle", "native"]) {
            const result = spawnSync(
                process.execPath,
                [
                    "--input-type=module",
                    "-e",
                    `
import assert from "node:assert/strict";
import { loadConfigFromFile } from "vite";
const loaded = await loadConfigFromFile(
    { command: "build", mode: "production" },
    "vite.${surface}.config.mts",
    undefined,
    undefined,
    undefined,
    "${loader}",
);
assert.ok(loaded);
assert.ok(loaded.config.plugins.some(plugin => plugin.name === "writeme-build-features"));
`,
                ],
                {
                    cwd: process.cwd(),
                    encoding: "utf8",
                    timeout: 15_000,
                    env: {
                        ...process.env,
                        VITE_CONFIG_NATIVE_IGNORE_WARNING: "",
                        WRITEME_BUILD_PROFILE: "macos-direct",
                        WRITEME_DISABLE_FEATURES: "",
                        WRITEME_ENABLE_FEATURES: "",
                    },
                },
            );

            expect(result.status, result.stderr).toBe(0);
            expect(result.stderr).not.toContain("unsupported by `configLoader: 'native'`");
        }
    });
});
