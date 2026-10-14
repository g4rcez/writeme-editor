export type CodeExecutionResult = {
    version: 1;
    executedAt: string;
    language: string;
    sourceFingerprint: string;
    stdout: string;
    stderr: string;
};

export const MAX_CODE_RESULT_CHARS = 100_000;
const MAX_SERIALIZED_RESULT_CHARS = 1_000_000;

export function stripCodeResultMetadata(markdown: string): string {
    return markdown.replace(/^<!-- writeme-code-result:v1:[A-Za-z0-9_-]+ -->\r?\n/gm, "");
}

export function validateCodeExecutionResult(value: unknown): value is CodeExecutionResult {
    if (value === null || typeof value !== "object") return false;
    const result = value as Record<string, unknown>;
    return (
        result.version === 1 &&
        typeof result.executedAt === "string" &&
        result.executedAt.length <= 40 &&
        !Number.isNaN(Date.parse(result.executedAt)) &&
        typeof result.language === "string" &&
        /^[a-zA-Z0-9_+#.-]{1,128}$/.test(result.language) &&
        typeof result.sourceFingerprint === "string" &&
        /^[a-f0-9]{64}$/.test(result.sourceFingerprint) &&
        typeof result.stdout === "string" &&
        typeof result.stderr === "string" &&
        result.stdout.length + result.stderr.length <= MAX_CODE_RESULT_CHARS
    );
}

export function parseCodeExecutionResult(serialized: string | null | undefined): CodeExecutionResult | null {
    if (!serialized || serialized.length > MAX_SERIALIZED_RESULT_CHARS) return null;
    try {
        const result: unknown = JSON.parse(serialized);
        return validateCodeExecutionResult(result) ? result : null;
    } catch {
        return null;
    }
}

export async function fingerprintCode(source: string): Promise<string> {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function encodeCodeResult(result: CodeExecutionResult): string {
    const bytes = new TextEncoder().encode(JSON.stringify(result));
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeCodeResult(encoded: string): CodeExecutionResult | null {
    if (encoded.length > MAX_SERIALIZED_RESULT_CHARS || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
    try {
        const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
        const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const result: unknown = JSON.parse(new TextDecoder().decode(bytes));
        return validateCodeExecutionResult(result) ? result : null;
    } catch {
        return null;
    }
}
