import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react({})],
  server: { port: 5173 },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "virtual:pwa-register/react": path.resolve(
        __dirname,
        "./src/lib/pwa-register-stub.ts",
      ),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("shiki")) return "shiki";
          if (id.includes("mermaid")) return "mermaid";
          if (id.includes("@excalidraw")) return "excalidraw";
          if (id.includes("viz-js") || id.includes("graphviz"))
            return "graphviz";
          if (id.includes("flowchart.js") || id.includes("raphael"))
            return "flowchart";
          if (id.includes("mathjs")) return "mathjs";
          if (id.includes("katex")) return "math";
          if (id.includes("react-dom") || id.includes("node_modules/react/"))
            return "react-vendor";
        },
      },
    },
  },
});
