import path from "node:path";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import { buildFeaturePlugin, restrictedFeature } from "./feature-plugin.mts";
import { resolveBuildProfile } from "./profiles.mts";

describe("compiled capability removal", () => {
    it.each(["macos-app-store", "ios-app-store", "android-google-play"])(
        "removes the Vim evaluator and compiler from %s",
        async (name) => {
            const result = await build({
                configFile: false,
                plugins: [buildFeaturePlugin(resolveBuildProfile(name), "renderer")],
                logLevel: "silent",
                build: {
                    write: false,
                    minify: false,
                    lib: { entry: path.resolve("packages/editor/src/app/vim/scripts/evaluate.ts"), formats: ["es"] },
                },
            });
            const output = Array.isArray(result) ? result[0] : result;
            if (!output || !("output" in output)) throw new Error("Compiled output is missing");
            const chunk = output.output.find((value) => value.type === "chunk");
            if (!chunk || chunk.type !== "chunk") throw new Error("Compiled module is missing");
            expect(chunk.code).not.toMatch(/new Function\s*\(/);
            expect(chunk.moduleIds.some((id) => id.includes("node_modules/sucrase"))).toBe(false);
            const module = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString("base64")}`);
            expect(() => module.evaluateVimConfiguration("globalThis.vimStoreBypass = true")).toThrow("vimScripts");
            expect(globalThis).not.toHaveProperty("vimStoreBypass");
        },
    );
    it.each(["macos-app-store", "ios-app-store", "android-google-play"])(
        "removes executable implementation and preserves the hard block for %s",
        async (name) => {
            const result = await build({
                configFile: false,
                plugins: [buildFeaturePlugin(resolveBuildProfile(name), "renderer")],
                logLevel: "silent",
                build: {
                    write: false,
                    minify: false,
                    lib: { entry: path.resolve("packages/editor/src/lib/run-javascript.ts"), formats: ["es"] },
                },
            });
            const output = Array.isArray(result) ? result[0] : result;
            if (!output || !("output" in output)) throw new Error("Compiled output is missing.");
            const chunk = output.output.find((output) => output.type === "chunk");
            if (!chunk || chunk.type !== "chunk") throw new Error("Compiled module is missing.");
            expect(chunk.code).not.toMatch(/\beval\s*\(/);
            const module = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString("base64")}`);
            expect(() => module.runJavascript("globalThis.storeBypass = true")).toThrow("unavailable");
            expect(globalThis).not.toHaveProperty("storeBypass");
            expect(output.output.some((output) => output.fileName === "writeme-build-renderer.json")).toBe(true);
        },
    );
    it("keeps execution in the direct build", async () => {
        const result = await build({
            configFile: false,
            plugins: [buildFeaturePlugin(resolveBuildProfile("macos-direct"), "renderer")],
            logLevel: "silent",
            build: {
                write: false,
                minify: false,
                lib: { entry: path.resolve("packages/editor/src/lib/run-javascript.ts"), formats: ["es"] },
            },
        });
        const output = Array.isArray(result) ? result[0] : result;
        if (!output || !("output" in output)) throw new Error("Compiled output is missing.");
        const chunk = output.output.find((output) => output.type === "chunk");
        if (!chunk || chunk.type !== "chunk") throw new Error("Compiled module is missing.");
        const module = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString("base64")}`);
        expect(module.runJavascript("1 + 2")).toBe(3);
    });
    it("covers native handlers, installers, network adapters and updater implementations", () => {
        const profile = resolveBuildProfile("macos-app-store");
        const root = path.resolve("packages/editor/src");
        for (const file of [
            "ipc/terminal.ipc.ts",
            "ipc/execution.ipc.ts",
            "ipc/git.ipc.ts",
            "main-process/cli-installer.ts",
            "main-process/cli-server.ts",
            "lib/meeting-installer.ts",
            "main-process/app-updater.ts",
            "app/ai/adapters/openai.adapter.ts",
            "lib/run-template-script.ts",
            "app/vim/scripts/evaluate.ts",
            "app/vim/scripts/compile.ts",
            "app/vim/scripts/configuration.worker.ts",
            "server/proxy.ts",
        ]) {
            expect(restrictedFeature(path.join(root, file), profile), file).toBeDefined();
            expect(
                restrictedFeature(path.join(root, file), resolveBuildProfile("macos-homebrew")),
                file,
            ).toBeUndefined();
        }
        expect(restrictedFeature(path.join(root, "lib/meeting-transcript.ts"), profile)).toBeUndefined();
        expect(restrictedFeature(path.join(root, "app/elements/code-block/math-block.tsx"), profile)).toBeUndefined();
    });
});
