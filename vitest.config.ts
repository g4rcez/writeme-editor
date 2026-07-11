import react from "@vitejs/plugin-react";
import path from "path";
/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            solver: path.resolve(__dirname, "./packages/solver/src"),
            "virtual:pwa-register/react": path.resolve(__dirname, "./src/lib/pwa-register-stub.ts"),
            "use-sync-external-store/shim/with-selector": path.resolve(
                __dirname,
                "node_modules/use-sync-external-store/shim/with-selector.js",
            ),
        },
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: "./src/test/setup.ts",
        exclude: ["packages/**", "node_modules/**", "tests/**"],
    },
});
