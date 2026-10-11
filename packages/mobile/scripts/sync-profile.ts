import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { resolveBuildProfile } from "../../../build/profiles.mts";

const os = process.argv[2];
if (os !== "ios" && os !== "android") throw new Error("Choose ios or android.");
const name = process.env.WRITEME_BUILD_PROFILE ?? (os === "ios" ? "ios-app-store" : "android-google-play");
const expected = resolveBuildProfile(name, process.env.WRITEME_DISABLE_FEATURES);
if (expected.os !== os) throw new Error(`Cannot sync ${expected.os} assets into ${os}.`);
const manifest = JSON.parse(
    await readFile(path.resolve(import.meta.dirname, "../dist/writeme-build-renderer.json"), "utf8"),
) as unknown;
if (
    !manifest ||
    typeof manifest !== "object" ||
    !("os" in manifest) ||
    !("channel" in manifest) ||
    !("features" in manifest) ||
    manifest.os !== expected.os ||
    manifest.channel !== expected.channel ||
    JSON.stringify(manifest.features) !== JSON.stringify(expected.features)
) {
    throw new Error(`Mobile assets do not match ${name}. Rebuild with npm run build:profile -- ${name} sync.`);
}
const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["exec", "--", "cap", "sync", os], {
    stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
