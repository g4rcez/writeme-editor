import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react({})],
  server: { port: 5173 },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          shiki: ["shiki"],
          mermaid: ["mermaid"],
          "react-vendor": ["react", "react-dom"],
        },
      },
    },
  },
});
