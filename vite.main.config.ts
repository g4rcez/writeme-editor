import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  plugins: [VitePWA({ registerType: "autoUpdate" })],
});
