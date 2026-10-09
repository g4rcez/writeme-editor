import tailwindcss from "@tailwindcss/vite";
import { createServer } from "vite";
import { describe, expect, it } from "vitest";

describe("editor stylesheet", () => {
    it("compiles the app's imported CSS with the configured Tailwind utilities", async () => {
        const server = await createServer({
            configFile: false,
            appType: "custom",
            plugins: [tailwindcss()],
            optimizeDeps: { noDiscovery: true },
            server: { middlewareMode: true, hmr: false, watch: null },
        });

        try {
            const result = await server.transformRequest("/packages/editor/src/index.css?direct");

            expect(result?.code).toContain(".writeme-editor-group-header");
            expect(result?.code).not.toMatch(/@apply\s/);
        } finally {
            await server.close();
        }
    });
});
