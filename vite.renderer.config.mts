import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { buildFeaturePlugin } from "./build/feature-plugin.mts";
import { desktopProfile } from "./build/profiles.mts";
import { pdfAssets } from "./scripts/pdf-assets.mts";

export default defineConfig(({ mode }) => {
    const browserDefines = {
        "process.env.IS_PREACT": JSON.stringify("false"),
        "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development"),
    };

    return {
        base: "./",
        define: browserDefines,
        optimizeDeps: {
            rolldownOptions: {
                transform: { define: browserDefines },
            },
        },
        plugins: [buildFeaturePlugin(desktopProfile(), "renderer"), pdfAssets(), tailwindcss(), react({})],
        server: { port: 5173 },
        resolve: {
            alias: {
                "@": path.resolve(import.meta.dirname, "./packages/editor/src"),
                "@writeme.dev/math": path.resolve(import.meta.dirname, "./packages/math/src"),
                "virtual:pwa-register/react": path.resolve(
                    import.meta.dirname,
                    "./packages/editor/src/lib/pwa-register-stub.ts",
                ),
            },
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: (id) => {
                        if (id.includes("flowchart.js") || id.includes("raphael")) return "flowchart";
                        if (id.includes("katex")) return "math";
                        if (id.includes("react-dom") || id.includes("node_modules/react/")) return "react-vendor";
                    },
                },
            },
        },
    };
});
