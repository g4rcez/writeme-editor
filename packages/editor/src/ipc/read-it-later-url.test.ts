import { describe, expect, it } from "vitest";
import { createCachedLookup, isPublicHttpUrl } from "./read-it-later-url";

const publicLookup = async (): Promise<string[]> => ["93.184.216.34"];
const loopbackLookup = async (): Promise<string[]> => ["127.0.0.1"];
const mixedLookup = async (): Promise<string[]> => ["93.184.216.34", "10.0.0.5"];

describe("isPublicHttpUrl", () => {
    it("accepts a public http(s) host", async () => {
        expect(await isPublicHttpUrl("https://example.com/a", publicLookup)).toBe(true);
        expect(await isPublicHttpUrl("http://93.184.216.34/", publicLookup)).toBe(true);
    });

    it("rejects non-http protocols", async () => {
        expect(await isPublicHttpUrl("file:///etc/passwd", publicLookup)).toBe(false);
        expect(await isPublicHttpUrl("ftp://example.com/", publicLookup)).toBe(false);
    });

    it("rejects invalid urls", async () => {
        expect(await isPublicHttpUrl("not a url", publicLookup)).toBe(false);
    });

    it.each([
        "http://localhost:3000/",
        "http://localhost./",
        "http://foo.localhost./",
        "http://127.0.0.1/",
        "http://2130706433/",
        "http://10.1.2.3/",
        "http://172.16.0.1/",
        "http://172.31.255.255/",
        "http://192.168.1.1/",
        "http://169.254.169.254/latest/meta-data/",
        "http://100.64.0.1/",
        "http://224.0.0.1/",
        "http://0.0.0.0/",
        "http://[::1]/",
        "http://[fe80::1]/",
        "http://[fd00::1]/",
        "http://[fec0::1]/",
        "http://[ff02::1]/",
        "http://[::ffff:127.0.0.1]/",
        "http://[::ffff:7f00:1]/",
        "http://[::7f00:1]/",
        "http://[64:ff9b::7f00:1]/",
        "http://[2002:7f00:1::]/",
    ])("rejects %s", async (url) => {
        expect(await isPublicHttpUrl(url, publicLookup)).toBe(false);
    });

    it.each(["http://172.15.0.1/", "http://172.32.0.1/", "http://100.63.0.1/", "http://[2606:4700::1111]/"])(
        "accepts public literal %s",
        async (url) => {
            expect(await isPublicHttpUrl(url, publicLookup)).toBe(true);
        },
    );

    it("rejects a hostname that resolves to a private address", async () => {
        expect(await isPublicHttpUrl("http://intranet.example/", loopbackLookup)).toBe(false);
        expect(await isPublicHttpUrl("http://mixed.example/", mixedLookup)).toBe(false);
    });

    it("rejects a hostname that does not resolve", async () => {
        const failing = async (): Promise<string[]> => {
            throw new Error("ENOTFOUND");
        };
        expect(await isPublicHttpUrl("http://nope.example/", failing)).toBe(false);
    });
});

describe("createCachedLookup", () => {
    it("resolves each hostname once", async () => {
        let calls = 0;
        const lookup = createCachedLookup(async () => {
            calls += 1;
            return ["93.184.216.34"];
        });
        await isPublicHttpUrl("https://example.com/a", lookup);
        await isPublicHttpUrl("https://example.com/b.png", lookup);
        expect(calls).toBe(1);
    });
});
