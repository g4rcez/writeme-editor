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
                        assert.match(config.packagerConfig.extendInfo.NSMicrophoneUsageDescription, /microphone/);
                        assert.match(config.packagerConfig.extendInfo.NSAudioCaptureUsageDescription, /meeting audio/);
                        assert.match(config.packagerConfig.extendInfo.NSAppleEventsUsageDescription, /Apple events/);
                        if (process.argv[2] === "notarized") {
                            const { optionsForFile, ...signing } = config.packagerConfig.osxSign;
                            assert.deepEqual(signing, {
                                identity: "Developer ID Application: Signing Fixture",
                                preAutoEntitlements: false,
                                continueOnError: false,
                            });
                            const app = optionsForFile("/out/writeme.app");
                            assert.equal(app.hardenedRuntime, true);
                            assert.equal("timestamp" in app, false);
                            assert.match(app.entitlements, /entitlements[.]mac[.]plist$/);
                            assert.deepEqual(optionsForFile("/out/writeme.app/Contents/MacOS/writeme"), app);
                            const cli = "/out/writeme.app/Contents/Resources/app.asar.unpacked/packages/cli/dist/writeme";
                            assert.match(optionsForFile(cli).entitlements, /entitlements[.]cli[.]plist$/);
                            const helper = "/out/writeme.app/Contents/Frameworks/writeme Helper (GPU).app";
                            assert.deepEqual(optionsForFile(helper), { hardenedRuntime: true });
                            assert.deepEqual(config.packagerConfig.osxNotarize, { keychainProfile: "fixture-profile" });
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
                        assert.equal(dmgMaker.configOrConfigFetcher.background, "./public/dmg-background.png");
                        assert.equal(dmgMaker.configOrConfigFetcher.iconSize, 88);
                        assert.deepEqual(dmgMaker.configOrConfigFetcher.additionalDMGOptions.window, {
                            size: { width: 658, height: 498 },
                        });
                        assert.deepEqual(dmgMaker.configOrConfigFetcher.contents({ appPath: "/tmp/writeme.app" }), [
                            { x: 179, y: 257, type: "file", path: "/tmp/writeme.app" },
                            { x: 485, y: 257, type: "link", path: "/Applications" },
                        ]);
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
                        // "-" keeps this test independent of the certificates in the keychain of this machine.
                        APPLE_SIGNING_IDENTITY: notarization ? "Developer ID Application: Signing Fixture" : "-",
                        WRITEME_NOTARY_PROFILE: notarization ? "fixture-profile" : "",
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
