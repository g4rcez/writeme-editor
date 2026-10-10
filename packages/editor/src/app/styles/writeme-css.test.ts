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

            expect(result?.code).toContain(".bg-card-background");
            expect(result?.code).not.toMatch(/@apply\s/);
            expect(result?.code).toContain("--wm-rail:");
            expect(result?.code).not.toContain(".writeme-aside-collapsed-toggle");
            expect(result?.code).not.toContain(".writeme-sidebar-v2-group");
            expect(result?.code).not.toContain(".writeme-editor-bubble");
            expect(result?.code).not.toMatch(/--wm-accent\s*:/);
            expect(result?.code).not.toMatch(/--native-liquid-glass-bg-soft\s*:/);

            const paragraph = result?.code.match(/\.writeme-editor-content p\s*\{([^}]+)\}/)?.[1];
            expect(paragraph).toMatch(/white-space:\s*pre-wrap/);
            expect(paragraph).not.toMatch(/white-space-collapse:\s*preserve-breaks/);
        } finally {
            await server.close();
        }
    });
});
