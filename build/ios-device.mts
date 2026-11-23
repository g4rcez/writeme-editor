import path from "node:path";

export const LOCAL_BUNDLE_ID = "dev.writeme.app.local";
export const STORE_BUNDLE_ID = "dev.writeme.app";

export type DeviceInfo = {
    id: string;
    udid: string;
    name: string;
    state: string;
    model: string;
    pairing: string;
    developerMode: string;
};

type Json = Record<string, unknown>;
const asRecord = (value: unknown): Json => (value && typeof value === "object" ? (value as Json) : {});
const asString = (value: unknown): string => (typeof value === "string" ? value : "");

/** Physical devices from `xcrun devicectl list devices --json-output`; simulated entries are dropped. */
export function listPhysicalDevices(json: unknown): Array<DeviceInfo> {
    const devices = asRecord(asRecord(json).result).devices;
    if (!Array.isArray(devices)) {return [];}
    return devices.flatMap((entry): Array<DeviceInfo> => {
        const hardware = asRecord(asRecord(entry).hardwareProperties);
        if (asString(hardware.reality) === "simulated") {return [];}
        const id = asString(asRecord(entry).identifier);
        const udid = asString(hardware.udid) || id;
        if (!id) {return [];}
        return [
            {
                id,
                udid,
                name: asString(asRecord(asRecord(entry).deviceProperties).name) || udid,
                state: asString(asRecord(asRecord(entry).connectionProperties).tunnelState) || "unknown",
                model: asString(hardware.marketingName) || asString(hardware.productType),
                pairing: asString(asRecord(asRecord(entry).connectionProperties).pairingState) || "unknown",
                developerMode: asString(asRecord(asRecord(entry).deviceProperties).developerModeStatus) || "unknown",
            },
        ];
    });
}

const describe = (devices: Array<DeviceInfo>): string =>
    devices
        .map((device) => `  - ${device.name} (${device.model || "iOS device"}, ${device.udid}) [${device.state}]`)
        .join("\n");

export function pickDevice(devices: Array<DeviceInfo>, wanted?: string): DeviceInfo {
    const query = wanted?.trim().toLowerCase();
    const matches = query
        ? devices.filter((device) =>
              [device.name, device.udid, device.id].some((value) => value.toLowerCase() === query),
          )
        : devices;
    if (query && matches.length === 0) {
        throw new Error(
            `No paired device matches WRITEME_IOS_DEVICE="${wanted}".${devices.length ? `\nPaired devices:\n${describe(devices)}` : ""}`,
        );
    }
    const connected = matches.filter((device) => device.state === "connected");
    const [only] = connected;
    if (connected.length === 1 && only) {
        if (only.developerMode === "disabled") {
            throw new Error(
                `Developer Mode is off on "${only.name}". On the iPhone open Settings > Privacy & Security, scroll to the bottom, turn on Developer Mode and let it restart, then confirm with your passcode.\nIf the switch is missing, run this command once more: the failed attempt makes iOS reveal it.`,
            );
        }
        return only;
    }
    if (connected.length > 1) {
        throw new Error(
            `More than one iPhone is connected. Set WRITEME_IOS_DEVICE to a name or UDID:\n${describe(connected)}`,
        );
    }
    const unpaired = matches.filter((device) => device.pairing === "unpaired");
    if (unpaired.length) {
        throw new Error(
            `This Mac is not trusted by the iPhone yet. Plug it in with a cable, unlock it and tap Trust This Computer (enter the passcode):\n${describe(unpaired)}`,
        );
    }
    throw new Error(
        matches.length
            ? `Your iPhone is paired but not reachable. Plug it in with a cable and unlock it:\n${describe(matches)}`
            : "No iPhone found. Plug it in with a cable, unlock it and tap Trust This Computer.",
    );
}

export function validateTeam(team: string | undefined): string {
    if (!team) {
        throw new Error(
            [
                "WRITEME_IOS_TEAM is not set.",
                "1. Xcode > Settings > Accounts > add your Apple ID (a free account works).",
                "2. Open the team's details and copy the 10-character Team ID (or find it under Personal Team in the Signing & Capabilities tab).",
                "3. Run: WRITEME_IOS_TEAM=<TEAMID> npm run ios:device",
            ].join("\n"),
        );
    }
    if (!/^[A-Z0-9]{10}$/.test(team)) {
        throw new Error(`WRITEME_IOS_TEAM must be the 10-character Team ID (letters and digits), got "${team}".`);
    }
    return team;
}

/**
 * A free/personal team that registers `dev.writeme.app` can block your paid team from claiming it later,
 * so device builds default to a separate identifier and refuse the store one unless explicitly allowed.
 */
export function resolveBundleId(requested: string | undefined, allowStore = false): string {
    const bundleId = requested?.trim() || LOCAL_BUNDLE_ID;
    if (!/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(bundleId)) {throw new Error(`Invalid bundle identifier: "${bundleId}".`);}
    if (bundleId === STORE_BUNDLE_ID && !allowStore) {
        throw new Error(
            `Refusing to register ${STORE_BUNDLE_ID} from a development team: it may become unavailable for the App Store account.\nUse the default (${LOCAL_BUNDLE_ID}) or set WRITEME_IOS_ALLOW_STORE_BUNDLE_ID=1 if this team will publish the app.`,
        );
    }
    return bundleId;
}

export function deviceBuildArgs(options: {
    project: string;
    derivedData: string;
    udid: string;
    team: string;
    bundleId: string;
}): Array<string> {
    return [
        "-project",
        options.project,
        "-scheme",
        "App",
        "-configuration",
        "Debug",
        "-destination",
        `id=${options.udid}`,
        "-derivedDataPath",
        options.derivedData,
        "-allowProvisioningUpdates",
        "-allowProvisioningDeviceRegistration",
        `DEVELOPMENT_TEAM=${options.team}`,
        `PRODUCT_BUNDLE_IDENTIFIER=${options.bundleId}`,
        "CODE_SIGN_STYLE=Automatic",
        "build",
    ];
}

export const deviceAppPath = (derivedData: string): string =>
    path.join(derivedData, "Build", "Products", "Debug-iphoneos", "App.app");
