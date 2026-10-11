import path from "node:path";
import { defineConfig, type UserConfig } from "vite";
import { buildFeaturePlugin } from "./build/feature-plugin.mts";
import { desktopProfile } from "./build/profiles.mts";

const removeForgeInlineDynamicImports = {
    name: "writeme-preload-rolldown-options",
    config(config: UserConfig) {
        const output = config.build?.rollupOptions?.output;
        if (output && !Array.isArray(output)) delete output.inlineDynamicImports;
    },
};

export default defineConfig({
    plugins: [buildFeaturePlugin(desktopProfile(), "preload"), removeForgeInlineDynamicImports],
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "./packages/editor/src") } },
    build: {
        rolldownOptions: { output: { codeSplitting: false } },
    },
});
