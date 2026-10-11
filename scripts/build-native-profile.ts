import { spawnSync } from "node:child_process";
import path from "node:path";
import { build } from "vite";
import { desktopProfile } from "../build/profiles.mts";

async function main(): Promise<void> {
    const profile = desktopProfile();
    const name = process.env.WRITEME_BUILD_PROFILE;
    if (!name) throw new Error("Set WRITEME_BUILD_PROFILE to build native verification assets.");
    const root = path.resolve("artifacts/build-profiles", name);

    for (const surface of ["main", "preload"] as const) {
        await build({
            configFile: path.resolve(`vite.${surface}.config.mts`),
            define: {
                MAIN_WINDOW_VITE_DEV_SERVER_URL: "undefined",
                MAIN_WINDOW_VITE_NAME: JSON.stringify("main_window"),
            },
            build: {
                ssr: true,
                emitAssets: true,
                outDir: path.join(root, "build"),
                emptyOutDir: surface === "main",
                lib: {
                    entry: path.resolve(`packages/editor/src/${surface}.ts`),
                    formats: ["cjs"],
                    fileName: () => `${surface}.js`,
                },
                rollupOptions: {
                    external: [
                        "electron",
                        "electron-squirrel-startup",
                        "better-sqlite3",
                        "node-pty",
                        "file-type",
                        "bufferutil",
                        "utf-8-validate",
                    ],
                },
            },
        });
    }
    const result = spawnSync(
        process.platform === "win32" ? "npm.cmd" : "npm",
        [
            "exec",
            "--",
            "vite",
            "build",
            "--config",
            "vite.renderer.config.mts",
            "--outDir",
            path.join(root, "renderer/main_window"),
        ],
        { stdio: "inherit" },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error("Native verification renderer build failed.");
    console.log(`Compiled native ${profile.os}/${profile.channel} verification assets at ${root}`);
}

void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
