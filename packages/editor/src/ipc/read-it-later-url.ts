import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

export type HostLookup = (hostname: string) => Promise<string[]>;

const resolveAll: HostLookup = async (hostname) => (await lookup(hostname, { all: true })).map((a) => a.address);

const privateRanges = new BlockList();
for (const [network, prefix] of [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.168.0.0", 16],
    ["224.0.0.0", 3],
] as const) {
    privateRanges.addSubnet(network, prefix, "ipv4");
}
// IPv4-mapped IPv6 (::ffff:a.b.c.d) is matched by the IPv4 rules above. The transition ranges
// (IPv4-compatible, NAT64, 6to4) embed an IPv4 address, so they are blocked whole.
for (const [network, prefix] of [
    ["::", 96],
    ["64:ff9b::", 96],
    ["2002::", 16],
    ["fc00::", 7],
    ["fe80::", 10],
    ["fec0::", 10],
    ["ff00::", 8],
] as const) {
    privateRanges.addSubnet(network, prefix, "ipv6");
}

const isPrivateAddress = (ip: string): boolean => privateRanges.check(ip, isIP(ip) === 4 ? "ipv4" : "ipv6");

/** Resolver that looks up each hostname once. Use one per page fetch. */
export const createCachedLookup = (resolve: HostLookup = resolveAll): HostLookup => {
    const cache = new Map<string, Promise<string[]>>();
    return (hostname) => {
        const cached = cache.get(hostname) ?? resolve(hostname);
        cache.set(hostname, cached);
        return cached;
    };
};

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
    const host = parsed.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
    if (host === "localhost" || host.endsWith(".localhost")) return false;
    if (isIP(host)) return !isPrivateAddress(host);
    try {
        const addresses = await resolve(host);
        return addresses.length > 0 && addresses.every((address) => !isPrivateAddress(address));
    } catch {
        return false;
    }
};
