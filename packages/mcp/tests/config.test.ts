import { describe, expect, it } from "bun:test";
import path from "node:path";
import { defaultDataDir, parseOptions } from "../src/config.ts";

describe("startup options", () => {
    it("uses desktop production and development profile locations", () => {
        expect(defaultDataDir("production", "darwin", {}, "/users/test")).toBe(
            path.join("/users/test", "Library", "Application Support", "writeme"),
        );
        expect(defaultDataDir("development", "linux", { XDG_CONFIG_HOME: "/config" }, "/users/test")).toBe(
            path.join("/config", "writeme-dev"),
        );
        expect(defaultDataDir("production", "win32", { APPDATA: "/roaming" }, "/users/test")).toBe(
            path.join("/roaming", "writeme"),
        );
    });

    it("allows explicit isolated storage and workspace roots", () => {
        const { reader } = parseOptions([
            "--profile",
            "development",
            "--data-dir",
            "fixtures",
            "--workspace",
            "notes",
        ]);
        expect(reader).toEqual({
            profile: "development",
            dataDir: path.resolve("fixtures"),
            workspace: path.resolve("notes"),
        });
    });

    it("rejects unknown flags, invalid profiles, empty paths and positional paths", () => {
        for (const args of [["--write"], ["--profile", "invalid"], ["--workspace", ""], ["notes"]]) {
            expect(() => parseOptions(args)).toThrow();
        }
    });
});
