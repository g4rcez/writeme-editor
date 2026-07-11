import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    base: "/",
    appType: "spa",
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            solver: path.resolve(__dirname, "./packages/solver/src"),
        },
    },
    optimizeDeps: {
        include: ["@catppuccin/codemirror", "@codemirror/lang-sql"],
    },
    plugins: [
        tailwindcss(),
        react({
            babel: {
                plugins: [["babel-plugin-react-compiler"]],
            },
        }),
        VitePWA({
            registerType: "autoUpdate",
            devOptions: { enabled: true },
            workbox: {
                clientsClaim: true,
                navigateFallback: null,
                navigationPreload: true,
                cleanupOutdatedCaches: true,
                globPatterns: ["**/*.{js,css,ico,png,svg}"],
                maximumFileSizeToCacheInBytes: Number.MAX_SAFE_INTEGER,
                runtimeCaching: [
                    {
                        urlPattern: ({ request }) => request.mode === "navigate",
                        handler: "NetworkFirst",
                        options: {
                            cacheName: "writeme-pages",
                            cacheableResponse: { statuses: [200] },
                            expiration: {
                                maxAgeSeconds: 24 * 60 * 60,
                                maxEntries: 10,
                            },
                            networkTimeoutSeconds: 10,
                        },
                    },
                ],
                skipWaiting: true,
            },
            manifest: {
                lang: "en-US",
                name: "Writeme",
                orientation: "any",
                display: "standalone",
                short_name: "Writeme",
                theme_color: "#171717",
                background_color: "#000000",
                id: "https://www.writeme.dev/",
                scope: "https://www.writeme.dev/",
                start_url: "/",
                description: "The home of your ideas",
                icons: [
                    {
                        src: "/android-chrome-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                        purpose: "any",
                    },
                    {
                        src: "/android-chrome-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any",
                    },
                    {
                        src: "/android-chrome-maskable-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                    {
                        src: "/favicon.svg",
                        sizes: "any",
                        type: "image/svg+xml",
                        purpose: "any",
                    },
                ],
            },
        }),
    ],
    build: {
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    if (id.includes("shiki")) return "shiki";
                    if (id.includes("mermaid")) return "mermaid";
                    if (id.includes("@excalidraw")) return "excalidraw";
                    if (id.includes("viz-js") || id.includes("graphviz")) return "graphviz";
                    if (id.includes("flowchart.js") || id.includes("raphael")) return "flowchart";
                    if (id.includes("mathjs")) return "mathjs";
                    if (id.includes("katex")) return "math";
                    if (id.includes("react-dom") || id.includes("node_modules/react/")) return "react-vendor";
                },
            },
        },
    },
});
