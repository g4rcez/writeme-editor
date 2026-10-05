import react from "@vitejs/plugin-react";
import path from "path";
/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./packages/editor/src"),
            solver: path.resolve(__dirname, "./packages/solver/src"),
            "virtual:pwa-register/react": path.resolve(
                __dirname,
                "./packages/editor/src/lib/pwa-register-stub.ts",
            ),
            "use-sync-external-store/shim/with-selector": path.resolve(
                __dirname,
                "node_modules/use-sync-external-store/shim/with-selector.js",
            ),
        },
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: "./packages/editor/src/test/setup.ts",
        exclude: ["packages/cli/**", "packages/landing/**", "packages/solver/**", "node_modules/**", "tests/**"],
    },
});
