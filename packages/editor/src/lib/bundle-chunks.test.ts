import path from "node:path";
import { loadConfigFromFile } from "vite";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../../..");
const nodeModules = (name: string) => `${root}/node_modules/${name}`;

const manualChunks = async (file: string) => {
    const loaded = await loadConfigFromFile(
        { command: "build", mode: "production" } as Parameters<typeof loadConfigFromFile>[0],
        path.join(root, file),
    );
    const output = loaded?.config.build?.rollupOptions?.output;
    const chunks = (Array.isArray(output) ? output[0] : output)?.manualChunks;
    if (typeof chunks !== "function") throw new Error(`${file} has no manualChunks function`);
    return (id: string) => (chunks as (id: string, meta: never) => string | undefined)(id, undefined as never);
};

describe.each(["vite.renderer.config.mts", "vite.config.mts"])("%s manualChunks", (file) => {
    it.each([
        "shiki/dist/index.mjs",
        "@shikijs/langs/dist/typescript.mjs",
        "mermaid/dist/mermaid.core.mjs",
        "@excalidraw/excalidraw/dist/index.js",
        "@viz-js/viz/dist/viz.js",
        "mathjs/lib/esm/index.js",
    ])("does not force %s into one eagerly loaded chunk", async (module) => {
        expect((await manualChunks(file))(nodeModules(module))).toBeUndefined();
    });

    it("still splits React into its own vendor chunk", async () => {
        expect((await manualChunks(file))(nodeModules("react-dom/index.js"))).toBe("react-vendor");
    });
});
