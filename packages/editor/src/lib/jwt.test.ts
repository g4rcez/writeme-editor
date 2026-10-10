import { describe, expect, it } from "vitest";
import { decodeJwtPayload } from "./jwt";

const encodePayload = (payload: string): string =>
    btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const createToken = (payload: string): string => `header.${encodePayload(payload)}.signature`;

describe("decodeJwtPayload", () => {
    it("decodes a base64url JSON payload", () => {
        expect(decodeJwtPayload<{ sub: string }>(createToken(JSON.stringify({ sub: "user-1" })))).toEqual({
            sub: "user-1",
        });
    });

    it("returns null for missing or malformed payloads", () => {
        expect(decodeJwtPayload("{}")).toBeNull();
        expect(decodeJwtPayload("header.%%%invalid%%%.signature")).toBeNull();
        expect(decodeJwtPayload(createToken("not JSON"))).toBeNull();
        expect(decodeJwtPayload(undefined)).toBeNull();
    });
});
