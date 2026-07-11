import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
    base: "./",
    plugins: [tailwindcss(), react({})],
    server: { port: 5173 },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            solver: path.resolve(__dirname, "./packages/solver/src"),
            "virtual:pwa-register/react": path.resolve(__dirname, "./src/lib/pwa-register-stub.ts"),
        },
    },
    build: {
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
