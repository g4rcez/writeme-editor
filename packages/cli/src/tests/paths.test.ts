import { describe, expect, test } from "bun:test";
import { getAppBinary, getDbPath, getSocketPath } from "../lib/paths.ts";

describe("getSocketPath", () => {
    test("returns non-empty string containing 'writeme'", () => {
        const p = getSocketPath();
        expect(typeof p).toBe("string");
        expect(p.length).toBeGreaterThan(0);
        expect(p).toContain("writeme");
    });
});

describe("getDbPath", () => {
    test("returns string ending in .sqlite and containing 'writeme'", () => {
        const p = getDbPath();
        expect(typeof p).toBe("string");
        expect(p).toMatch(/\.sqlite$/);
        expect(p).toContain("writeme");
    });
});

describe("getAppBinary", () => {
    test("returns non-empty string", () => {
        const b = getAppBinary();
        expect(typeof b).toBe("string");
        expect(b.length).toBeGreaterThan(0);
    });
});
