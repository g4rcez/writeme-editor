import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { matchesProject, parseE2EArguments } from "./e2e-options.mts";
import { platformConfig } from "./playwright-platform.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);

function main(): void {
    const { platform, suite, forwarded, projects } = parseE2EArguments(process.argv.slice(2));
    const listing = forwarded.includes("--list");
    if (suite === "device" && !listing && !process.env.PLAYWRIGHT_DEVICE_BASE_URL) {
        throw new Error(
            "Set PLAYWRIGHT_DEVICE_BASE_URL to an HTTPS or device-local localhost app URL; physical Android/ADB and an operator with a pen are required.",
        );
    }
    if (
        !listing &&
        (suite === "native" || (platform === "osx" && suite === "profiles" && matchesProject("native-store", projects)))
    ) {
        const host = { windows: "win32", osx: "darwin", linux: "linux" };
        if (platform in host && host[platform as keyof typeof host] !== process.platform)
            throw new Error("Run native Electron tests on the requested desktop OS.");
    }
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        WRITEME_E2E_SUITE: suite,
        WRITEME_E2E_PROJECTS: JSON.stringify(projects),
    };
    platformConfig(platform, env);
    const run = (command: string, args: string[], childEnv = env): boolean => {
        const result = spawnSync(command, args, {
            cwd: root,
            env: childEnv,
            stdio: "inherit",
            shell: process.platform === "win32" && command === "npm.cmd",
        });
        if (result.error) throw result.error;
        process.exitCode = result.status ?? 1;
        return result.status === 0;
    };
    if (!listing && env.WRITEME_E2E_PREBUILT !== "1") {
        if (suite === "native" && !run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "package:app"]))
            return;
        if (suite === "profiles" && platform === "osx" && matchesProject("native-store", projects)) {
            if (
                !run(process.execPath, ["--import", "tsx", "scripts/build-native-profile.ts"], {
                    ...env,
                    WRITEME_BUILD_PROFILE: "macos-app-store",
                })
            )
                return;
        }
    }
    run(process.execPath, [
        require.resolve("@playwright/test/cli"),
        "test",
        "--config",
        `playwright.${platform}.config.ts`,
        ...forwarded,
    ]);
}

try {
    main();
} catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
