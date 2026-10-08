import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Forge configuration", () => {
    it.each([
        ["forge-first", false],
        ["config-first", false],
        ["forge-first", true],
        ["config-first", true],
    ] as const)(
        "loads ESM configs with final signing when loaded %s (notarization: %s)",
        (loadOrder, notarization) => {
            // Vitest's module loader must not hide duplicate modules in Forge's Node process.
            const result = spawnSync(
                process.execPath,
                [
                    "--input-type=commonjs",
                    "-e",
                    `
                    const assert = require("node:assert/strict");
                    const { createRequire } = require("node:module");
                    if (process.argv[1] === "config-first") require("./forge.config.js");
                    const loadForgeConfig = require("@electron-forge/core/dist/util/forge-config").default;
                    const requireFromForge = createRequire(require.resolve("@electron-forge/core"));
                    const { PluginBase } = requireFromForge("@electron-forge/plugin-base");

                    (async () => {
                        const config = await loadForgeConfig(process.cwd());
                        assert.equal(config.packagerConfig.icon, "./public/icon");
                        if (process.argv[2] === "notarized") {
                            assert.deepEqual(config.packagerConfig.osxSign, {
                                identity: "Developer ID Application: Signing Fixture",
                                continueOnError: false,
                            });
                            assert.deepEqual(config.packagerConfig.osxNotarize, {
                                appleId: "fixture@example.invalid",
                                appleIdPassword: "fixture-password",
                                teamId: "FIXTURETEAM",
                            });
                        } else {
                            const { optionsForFile, ...signing } = config.packagerConfig.osxSign;
                            assert.deepEqual(signing, {
                                identity: "-",
                                identityValidation: false,
                                preAutoEntitlements: false,
                                continueOnError: false,
                            });
                            assert.deepEqual(optionsForFile("writeme.app"), {
                                entitlements: [],
                                hardenedRuntime: false,
                                timestamp: "none",
                            });
                            assert.equal(config.packagerConfig.osxNotarize, undefined);
                        }
                        const squirrelMaker = config.makers.find(maker => maker.name === "squirrel");
                        const dmgMaker = config.makers.find(maker => maker.name === "dmg");
                        assert.equal(squirrelMaker.configOrConfigFetcher.setupIcon, "./public/icon.ico");
                        assert.equal(dmgMaker.configOrConfigFetcher.icon, "./public/icon.icns");
                        assert.deepEqual(config.plugins.map(plugin => plugin.name), [
                            "auto-unpack-natives", "vite", "fuses",
                        ]);
                        const owners = config.plugins.filter(plugin =>
                            typeof plugin.startLogic === "function" &&
                            plugin.startLogic !== PluginBase.prototype.startLogic
                        );
                        assert.deepEqual(owners.map(plugin => plugin.name), []);
                        assert.equal(await config.pluginInterface.overrideStartLogic({}), false);
                        const startupPlugins = config.plugins.filter(plugin => plugin.getHooks().preStart);
                        assert.deepEqual(startupPlugins.map(plugin => plugin.name), ["vite"]);

                        const requireFromPlugin = createRequire(require.resolve("@electron-forge/plugin-vite"));
                        assert.equal(requireFromPlugin.resolve("vite"), require.resolve("vite"));
                        const viteModule = requireFromPlugin("vite");
                        const viteDefault = viteModule.__esModule ? viteModule.default : viteModule;
                        assert.equal(typeof viteDefault?.createServer, "function");
                        const { loadConfigFromFile } = viteModule;
                        const targets = [...startupPlugins[0].config.build, ...startupPlugins[0].config.renderer];
                        assert.equal(targets.length, 3);
                        for (const target of targets) {
                            assert.match(target.config, /\\.mts$/);
                            for (const command of ["serve", "build"]) {
                                const mode = command === "serve" ? "development" : "production";
                                const loaded = await loadConfigFromFile({ command, mode }, target.config);
                                assert.equal(loaded.config.resolve.alias["@"], require("node:path").join(process.cwd(), "packages/editor/src"));
                                if (target.target === "main") assert.equal(loaded.config.build.rollupOptions.platform, "node");
                            }
                        }

                        process.stdout.write("forge-start-verified");
                    })().catch(error => {
                        console.error(error);
                        process.exitCode = 1;
                    });
                    `,
                    loadOrder,
                    notarization ? "notarized" : "ad-hoc",
                ],
                {
                    cwd: process.cwd(),
                    encoding: "utf8",
                    timeout: 10_000,
                    env: {
                        ...process.env,
                        APPLE_ID: notarization ? "fixture@example.invalid" : "",
                        APPLE_APP_SPECIFIC_PASSWORD: notarization ? "fixture-password" : "",
                        APPLE_TEAM_ID: notarization ? "FIXTURETEAM" : "",
                        APPLE_SIGNING_IDENTITY: notarization ? "Developer ID Application: Signing Fixture" : "",
                    },
                },
            );

            expect(result.error).toBeUndefined();
            expect(result.status, result.stderr || result.stdout).toBe(0);
            expect(result.stdout).toBe("forge-start-verified");
        },
        15_000,
    );
});
