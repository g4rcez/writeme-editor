import { describe, expect, it } from "vitest";
import {
    LOCAL_BUNDLE_ID,
    deviceAppPath,
    deviceBuildArgs,
    listPhysicalDevices,
    pickDevice,
    resolveBundleId,
    validateTeam,
} from "./ios-device.mts";

const entry = (
    name: string,
    udid: string,
    state: string,
    reality = "physical",
    pairing = "paired",
    developerMode = "enabled",
) => ({
    identifier: `core-${udid}`,
    hardwareProperties: { udid, reality, marketingName: "iPhone 17" },
    deviceProperties: { name, developerModeStatus: developerMode },
    connectionProperties: { tunnelState: state, pairingState: pairing },
});
const listing = (...devices: Array<unknown>) => ({ result: { devices } });

describe("listPhysicalDevices", () => {
    it("drops simulated devices and reads name, udid and state", () => {
        const devices = listPhysicalDevices(
            listing(entry("Sim", "SIM-1", "disconnected", "simulated"), entry("Allan's iPhone", "UDID-1", "connected")),
        );
        expect(devices).toEqual([
            {
                id: "core-UDID-1",
                udid: "UDID-1",
                name: "Allan's iPhone",
                state: "connected",
                model: "iPhone 17",
                pairing: "paired",
                developerMode: "enabled",
            },
        ]);
    });

    it("tolerates malformed output", () => {
        expect(listPhysicalDevices(null)).toEqual([]);
        expect(listPhysicalDevices({ result: {} })).toEqual([]);
        expect(listPhysicalDevices(listing({ hardwareProperties: {} }))).toEqual([]);
    });
});

describe("pickDevice", () => {
    const phone = listPhysicalDevices(listing(entry("Phone", "A", "connected")));

    it("takes the only connected device", () => expect(pickDevice(phone).udid).toBe("A"));

    it("explains how to connect when nothing is reachable", () => {
        expect(() => pickDevice([])).toThrow(/Plug it in/);
        const asleep = listPhysicalDevices(listing(entry("Phone", "A", "disconnected")));
        expect(() => pickDevice(asleep)).toThrow(/paired but not reachable/);
        const untrusted = listPhysicalDevices(listing(entry("Phone", "A", "disconnected", "physical", "unpaired")));
        expect(() => pickDevice(untrusted)).toThrow(/Trust This Computer/);
    });

    it("stops early when Developer Mode is off", () => {
        const locked = listPhysicalDevices(listing(entry("Phone", "A", "connected", "physical", "paired", "disabled")));
        expect(() => pickDevice(locked)).toThrow(/Developer Mode is off/);
    });

    it("asks for a choice when several are connected, and honours the selector by name or udid", () => {
        const two = listPhysicalDevices(listing(entry("Phone", "A", "connected"), entry("Pad", "B", "connected")));
        expect(() => pickDevice(two)).toThrow(/WRITEME_IOS_DEVICE/);
        expect(pickDevice(two, "pad").udid).toBe("B");
        expect(pickDevice(two, "A").name).toBe("Phone");
        expect(() => pickDevice(two, "Watch")).toThrow(/No paired device matches/);
    });
});

describe("validateTeam", () => {
    it("requires a 10-character team id and explains where to find it", () => {
        expect(() => validateTeam(undefined)).toThrow(/Xcode > Settings > Accounts/);
        expect(() => validateTeam("abc")).toThrow(/10-character/);
        expect(validateTeam("AB12CD34EF")).toBe("AB12CD34EF");
    });
});

describe("resolveBundleId", () => {
    it("defaults to the local identifier and protects the store one", () => {
        expect(resolveBundleId(undefined)).toBe(LOCAL_BUNDLE_ID);
        expect(() => resolveBundleId("dev.writeme.app")).toThrow(/Refusing/);
        expect(resolveBundleId("dev.writeme.app", true)).toBe("dev.writeme.app");
        expect(resolveBundleId("com.me.writeme")).toBe("com.me.writeme");
        expect(() => resolveBundleId("bad id!")).toThrow(/Invalid/);
    });
});

describe("build arguments", () => {
    it("builds a signed Debug app for the device", () => {
        const args = deviceBuildArgs({
            project: "/p/App.xcodeproj",
            derivedData: "/d",
            udid: "U",
            team: "AB12CD34EF",
            bundleId: LOCAL_BUNDLE_ID,
        });
        expect(args).toContain("id=U");
        expect(args).toContain("-allowProvisioningUpdates");
        expect(args).toContain("DEVELOPMENT_TEAM=AB12CD34EF");
        expect(args).toContain(`PRODUCT_BUNDLE_IDENTIFIER=${LOCAL_BUNDLE_ID}`);
        expect(args.at(-1)).toBe("build");
        expect(deviceAppPath("/d")).toBe("/d/Build/Products/Debug-iphoneos/App.app");
    });
});
