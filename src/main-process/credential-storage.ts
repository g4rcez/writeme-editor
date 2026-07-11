import type { DatabaseManager } from "./database";
import { parseAiCredentials } from "./database-schema";

const CREDENTIAL_KEYS = ["accessToken", "refreshToken", "apiKey", "idToken"] as const;

type SecureStorage = {
    isEncryptionAvailable(): boolean;
    encryptString(value: string): Buffer;
    decryptString(value: Buffer): string;
};

function protectSecret(secret: string | null, secureStorage: SecureStorage): string | null {
    if (!secret) return null;
    if (!secureStorage.isEncryptionAvailable()) return secret;
    return secureStorage.encryptString(secret).toString("base64");
}

function revealSecret(secret: string | null, secureStorage: SecureStorage): string | null {
    if (!secret) return null;
    if (!secureStorage.isEncryptionAvailable()) return secret;

    try {
        return secureStorage.decryptString(Buffer.from(secret, "base64"));
    } catch {
        return secret;
    }
}

export function withStoredCredentials(
    row: Record<string, unknown> | null,
    secureStorage: SecureStorage,
): Record<string, unknown> | null {
    if (!row) return null;
    const out: Record<string, unknown> = { ...row };
    for (const key of CREDENTIAL_KEYS) {
        const value = row[key];
        if (typeof value === "string") {
            out[key] = revealSecret(value, secureStorage);
        }
    }
    return out;
}

export function persistCredentialRow(
    creds: { [key: string]: unknown },
    secureStorage: SecureStorage,
): Record<string, unknown> {
    const output = { ...creds };
    for (const key of CREDENTIAL_KEYS) {
        const value = output[key];
        if (typeof value === "string" && value.trim()) {
            output[key] = protectSecret(value, secureStorage);
        }
    }
    return output;
}

export function migrateCredentialRow(
    value: unknown,
    manager: DatabaseManager,
    secureStorage: SecureStorage,
): { status: "imported" | "updated" | "identical" | "skipped" } {
    if (!secureStorage.isEncryptionAvailable()) {
        return { status: "skipped" };
    }
    const creds = parseAiCredentials(value);
    const existingRow = manager.db.prepare("SELECT * FROM aiCredentials WHERE adapterId = ?").get(creds.adapterId) as
        | Record<string, unknown>
        | undefined;
    const existing = withStoredCredentials(existingRow ?? null, secureStorage);
    const comparableKeys = [...CREDENTIAL_KEYS, "expiresAt", "baseUrl", "accountId"] as const;
    const sameSecrets = existing && comparableKeys.every((key) => (existing[key] ?? null) === (creds[key] ?? null));
    if (sameSecrets) return { status: "identical" };

    const sourceTime = Date.parse(String(creds.updatedAt ?? ""));
    const destinationTime = Date.parse(String(existing?.updatedAt ?? ""));
    if (
        existing &&
        !(Number.isFinite(sourceTime) && Number.isFinite(destinationTime) && sourceTime > destinationTime)
    ) {
        return { status: "skipped" };
    }

    const now = new Date().toISOString();
    const encrypted = persistCredentialRow(creds, secureStorage);
    manager.db
        .prepare(
            `
        INSERT OR REPLACE INTO aiCredentials
          (adapterId, accessToken, refreshToken, expiresAt, apiKey, baseUrl, accountId, idToken, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM aiCredentials WHERE adapterId = ?), ?), ?)
      `,
        )
        .run(
            creds.adapterId,
            encrypted.accessToken ?? null,
            encrypted.refreshToken ?? null,
            creds.expiresAt ?? null,
            encrypted.apiKey ?? null,
            creds.baseUrl ?? null,
            creds.accountId ?? null,
            encrypted.idToken ?? null,
            creds.adapterId,
            creds.createdAt instanceof Date ? creds.createdAt.toISOString() : (creds.createdAt ?? now),
            creds.updatedAt instanceof Date ? creds.updatedAt.toISOString() : (creds.updatedAt ?? now),
        );
    return { status: existing ? "updated" : "imported" };
}
