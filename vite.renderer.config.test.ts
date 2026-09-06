import path from "node:path";
import { loadConfigFromFile } from "vite";
import { describe, expect, it } from "vitest";

describe("renderer Vite environment definitions", () => {
    it("defines browser values for renderer dependencies", async () => {
        const loaded = await loadConfigFromFile(
            { command: "serve", mode: "development" },
            path.resolve("vite.renderer.config.mts"),
        );
        if (loaded === null) throw new Error("Renderer Vite config did not load");

        const expected = {
            "process.env.IS_PREACT": JSON.stringify("false"),
            "process.env.NODE_ENV": JSON.stringify("development"),
        };

        expect(loaded.config.define).toMatchObject(expected);
        expect(loaded.config.optimizeDeps?.rolldownOptions?.transform?.define).toMatchObject(expected);
    });
});
