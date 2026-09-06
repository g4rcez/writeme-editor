import path from "node:path";
import { defineConfig, type UserConfig } from "vite";

const removeForgeInlineDynamicImports = {
    name: "writeme-preload-rolldown-options",
    config(config: UserConfig) {
        const output = config.build?.rollupOptions?.output;
        if (output && !Array.isArray(output)) delete output.inlineDynamicImports;
    },
};

export default defineConfig({
    plugins: [removeForgeInlineDynamicImports],
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
    build: {
        rolldownOptions: { output: { codeSplitting: false } },
    },
});
