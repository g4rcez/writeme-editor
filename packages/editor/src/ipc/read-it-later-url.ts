import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type HostLookup = (hostname: string) => Promise<string[]>;

const resolveAll: HostLookup = async (hostname) => (await lookup(hostname, { all: true })).map((a) => a.address);

const isPrivateIPv4 = (ip: string): boolean => {
    const [a = 0, b = 0] = ip.split(".").map(Number);
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        a >= 224
    );
};

const isPrivateIPv6 = (ip: string): boolean => {
    const value = ip.toLowerCase();
    const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIPv4(mapped[1] ?? "");
    const mappedHex = value.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
        const high = parseInt(mappedHex[1] ?? "0", 16);
        return isPrivateIPv4(`${high >> 8}.${high & 255}.0.0`);
    }
    return value === "::" || value === "::1" || /^f[cd]/.test(value) || /^fe[89ab]/.test(value);
};

const isPrivateAddress = (ip: string): boolean => (isIP(ip) === 4 ? isPrivateIPv4(ip) : isPrivateIPv6(ip));

/**
 * True only for http(s) URLs whose host is a public address. Hostnames are resolved and every
 * address must be public. A DNS answer can still change between this check and the request.
 */
export const isPublicHttpUrl = async (url: string, resolve: HostLookup = resolveAll): Promise<boolean> => {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost")) return false;
    if (isIP(host)) return !isPrivateAddress(host);
    try {
        const addresses = await resolve(host);
        return addresses.length > 0 && addresses.every((address) => !isPrivateAddress(address));
    } catch {
        return false;
    }
};
