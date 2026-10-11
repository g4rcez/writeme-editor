import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { buildFeaturePlugin } from "../../build/feature-plugin.mts";
import { mobileProfile } from "../../build/profiles.mts";
import { pdfAssets } from "../../scripts/pdf-assets.mts";

const root = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
    root,
    base: "./",
    define: {
        "import.meta.env.VITE_WRITEME_TARGET": JSON.stringify("mobile"),
        "process.env.IS_PREACT": JSON.stringify("false"),
    },
    plugins: [
        buildFeaturePlugin(mobileProfile(), "renderer"),
        {
            name: "writeme-mobile-html",
            transformIndexHtml: {
                order: "pre",
                handler: (html) =>
                    html
                        .replace("/packages/editor/src/renderer.ts", "/packages/mobile/renderer.ts")
                        .replace(
                            /\s*<link[^>]*(?:rel="manifest"|href="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^"]*")[^>]*>/g,
                            "",
                        ),
            },
        },
        pdfAssets(),
        tailwindcss(),
        react(),
    ],
    resolve: {
        alias: {
            "@": path.join(root, "packages/editor/src"),
            "@writeme.dev/math": path.join(root, "packages/math/src"),
            "virtual:pwa-register/react": path.join(root, "packages/editor/src/lib/pwa-register-stub.ts"),
        },
    },
    build: { outDir: "packages/mobile/dist", emptyOutDir: true, chunkSizeWarningLimit: 2000 },
});
