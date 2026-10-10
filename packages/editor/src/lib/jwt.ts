// This decodes an unverified payload. Callers must not use it as proof of authenticity.
export function decodeJwtPayload<T extends object>(token: string | undefined): T | null {
    if (!token) return null;
    const [, payload] = token.split(".");
    if (!payload) return null;

    try {
        const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
        return JSON.parse(atob(padded)) as T;
    } catch {
        return null;
    }
}
