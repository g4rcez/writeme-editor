import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const bundledRuntimePackages = [
    "update-electron-app",
    "elysia",
    "@elysiajs/node",
    "@elysiajs/cors",
    "@sinclair/typebox",
    "puppeteer-core",
];
const optionalWsPackages = ["bufferutil", "utf-8-validate"];

describe("main-process Vite packaging config", () => {
    it("bundles runtime packages that are not copied into the packaged app", () => {
        const configSource = readFileSync("vite.main.config.mts", "utf8");

        for (const packageName of bundledRuntimePackages) {
            expect(configSource).not.toContain(`"${packageName}"`);
        }
    });

    it("externalizes optional ws native accelerators", () => {
        const configSource = readFileSync("vite.main.config.mts", "utf8");

        for (const packageName of optionalWsPackages) {
            expect(configSource).toContain(`"${packageName}"`);
        }
    });
});
