import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Forge configuration", () => {
    it.each(["forge-first", "config-first"])(
        "loads ESM configs without competing startup overrides when loaded %s",
        (loadOrder) => {
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
                                assert.equal(loaded.config.resolve.alias["@"], require("node:path").join(process.cwd(), "src"));
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
                ],
                { cwd: process.cwd(), encoding: "utf8", timeout: 10_000 },
            );

            expect(result.error).toBeUndefined();
            expect(result.status, result.stderr || result.stdout).toBe(0);
            expect(result.stdout).toBe("forge-start-verified");
        },
        15_000,
    );
});
