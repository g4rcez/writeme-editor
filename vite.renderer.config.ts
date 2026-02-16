import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react({})],
  server: { port: 5173 },
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
