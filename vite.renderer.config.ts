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
          if (id.includes("react-dom") || id.includes("node_modules/react/"))
            return "react-vendor";
        },
      },
    },
  },
});
