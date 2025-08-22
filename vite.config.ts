import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",
  appType: "spa",
  build: { sourcemap: true },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: true },
      workbox: {
        maximumFileSizeToCacheInBytes: 3000000,
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
      manifest: {
        lang: "en-US",
        name: "Writeme",
        orientation: "any",
        display: "standalone",
        short_name: "Writeme",
        theme_color: "#0284C5",
        background_color: "#000000",
        id: "https://www.writeme.dev/",
        scope: "https://www.writeme.dev/",
        start_url: "https://www.writeme.dev/",
        description: "The home of your ideas",
        icons: [
          {
            purpose: "maskable",
            sizes: "512x512",
            src: "/favicon-512x512.png",
            type: "image/png",
          },
          {
            purpose: "any",
            sizes: "512x512",
            src: "/favicon-512x512.png",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});
