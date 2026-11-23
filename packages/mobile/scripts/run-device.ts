import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
    deviceAppPath,
    deviceBuildArgs,
    listPhysicalDevices,
    pickDevice,
    resolveBundleId,
    validateTeam,
} from "../../../build/ios-device.mts";

const root = path.resolve(import.meta.dirname, "../../..");
const checkOnly = process.argv.includes("--check");

function run(command: string, args: Array<string>): void {
    const result = spawnSync(command, args, { stdio: "inherit" });
    if (result.error) {throw result.error;}
    if (result.status !== 0) {throw new Error(`${command} ${args[0] ?? ""} failed with exit code ${result.status}.`);}
}

function connectedDevices(): ReturnType<typeof listPhysicalDevices> {
    const dir = mkdtempSync(path.join(tmpdir(), "writeme-devices-"));
    const file = path.join(dir, "devices.json");
    try {
        const result = spawnSync("xcrun", ["devicectl", "list", "devices", "--json-output", file], {
            encoding: "utf8",
        });
        if (result.error) {throw result.error;}
        if (!existsSync(file)) {throw new Error(`devicectl could not list devices: ${result.stderr || result.stdout}`);}
        return listPhysicalDevices(JSON.parse(readFileSync(file, "utf8")));
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

try {
    const team = validateTeam(process.env.WRITEME_IOS_TEAM);
    const bundleId = resolveBundleId(
        process.env.WRITEME_IOS_BUNDLE_ID,
        process.env.WRITEME_IOS_ALLOW_STORE_BUNDLE_ID === "1",
    );
    const device = pickDevice(connectedDevices(), process.env.WRITEME_IOS_DEVICE);
    console.log(`Device: ${device.name} (${device.udid})\nTeam: ${team}\nBundle ID: ${bundleId}`);
    if (checkOnly) {
        console.log("Setup looks good. Run npm run ios:device to build and install.");
        process.exit(0);
    }

    const derivedData = path.join(root, "packages/ios/build/device");
    run(
        "xcodebuild",
        deviceBuildArgs({
            project: path.join(root, "packages/ios/native/App/App.xcodeproj"),
            derivedData,
            udid: device.udid,
            team,
            bundleId,
        }),
    );
    const app = deviceAppPath(derivedData);
    if (!existsSync(app)) {throw new Error(`Build finished but ${app} is missing.`);}
    run("xcrun", ["devicectl", "device", "install", "app", "--device", device.id, app]);
    const launch = spawnSync(
        "xcrun",
        ["devicectl", "device", "process", "launch", "--device", device.id, "--terminate-existing", bundleId],
        { stdio: "inherit" },
    );
    if (launch.status !== 0) {
        console.log(
            [
                "",
                "Installed, but it could not be launched automatically. On the iPhone:",
                "- Settings > Privacy & Security > Developer Mode must be on (the phone restarts once).",
                "- Free accounts: Settings > General > VPN & Device Management > trust your Apple ID, then open Writeme.",
            ].join("\n"),
        );
    } else {
        console.log(
            "\nWriteme is running on your iPhone. Free-account builds expire after 7 days; rerun this command to refresh.",
        );
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
