import { spawnSync } from "node:child_process";
import { resolveBuildProfile, BUILD_PROFILES, isStoreProfile } from "../build/profiles.mts";

const name = process.argv[2];
const action = process.argv[3] ?? "assets";
if (!name) throw new Error(`Select a profile: ${Object.keys(BUILD_PROFILES).join(", ")}`);
if (!["assets", "package", "sync"].includes(action)) throw new Error("Choose assets, package, or sync.");
const profile = resolveBuildProfile(name, process.env.WRITEME_DISABLE_FEATURES);
if (process.env.WRITEME_ENABLE_FEATURES) throw new Error("Feature enable overrides are forbidden.");
const mobile = profile.os === "ios" || profile.os === "android";
if (action === "sync" && !mobile) throw new Error("Sync requires a mobile profile.");
if (action === "package" && mobile)
    throw new Error("Use sync, then archive in Xcode or build a signed release bundle in Android Studio.");
const env = { ...process.env, WRITEME_BUILD_PROFILE: name };
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(args: string[]): void {
    const result = spawnSync(npm, args, { env, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(
    `Building ${name}: ${
        Object.entries(profile.features)
            .filter(([, value]) => value)
            .map(([key]) => key)
            .join(", ") || "core notes only"
    }`,
);
if (mobile) {
    if (action === "assets")
        run([
            "exec",
            "--",
            "vite",
            "build",
            "--config",
            "packages/mobile/vite.config.ts",
            "--outDir",
            `artifacts/build-profiles/${name}`,
        ]);
    else run(["run", "mobile:build"]);
    if (action === "sync") run(["run", "sync", "--workspace", `@writeme/${profile.os}`]);
} else if (profile.os === "web") {
    if (action !== "assets") throw new Error("Web profiles build assets only.");
    run(["exec", "--", "vite", "build", "--outDir", `artifacts/build-profiles/${name}`]);
} else if (action === "package") {
    if (profile.features.cli) run(["run", "build:cli"]);
    const platform =
        profile.os === "macos"
            ? isStoreProfile(profile)
                ? "mas"
                : "darwin"
            : profile.os === "windows"
              ? "win32"
              : "linux";
    run(["exec", "--", "electron-forge", "package", `--platform=${platform}`]);
} else {
    run([
        "exec",
        "--",
        "vite",
        "build",
        "--config",
        "vite.renderer.config.mts",
        "--outDir",
        `artifacts/build-profiles/${name}`,
    ]);
}
