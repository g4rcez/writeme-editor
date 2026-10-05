import type { DatabaseManager } from "./database";
import { parseAiCredentials } from "./database-schema";

const CREDENTIAL_KEYS = ["accessToken", "refreshToken", "apiKey", "idToken"] as const;

type SecureStorage = {
    isEncryptionAvailable(): boolean;
    getSelectedStorageBackend(): string;
    encryptString(value: string): Buffer;
    decryptString(value: Buffer): string;
};

type RevealedSecret = {
    value: string | null;
    protected: boolean;
};

function isSecureStorageSuitable(secureStorage: SecureStorage): boolean {
    try {
        if (!secureStorage.isEncryptionAvailable()) return false;
        if (process.platform !== "linux") return true;
        const backend = secureStorage.getSelectedStorageBackend();
        return backend !== "basic_text" && backend !== "unknown";
    } catch {
        return false;
    }
}

function revealSecret(secret: string | null, secureStorage: SecureStorage): RevealedSecret {
    if (!secret) return { value: null, protected: true };
    if (!secureStorage.isEncryptionAvailable()) return { value: secret, protected: false };

    try {
        return {
            value: secureStorage.decryptString(Buffer.from(secret, "base64")),
            protected: true,
        };
    } catch {
        return { value: secret, protected: false };
    }
}

function inspectStoredCredentials(
    row: Record<string, unknown>,
    secureStorage: SecureStorage,
): { value: Record<string, unknown>; protected: boolean } {
    const value: Record<string, unknown> = { ...row };
    let protectedSecrets = true;
    for (const key of CREDENTIAL_KEYS) {
        const stored = row[key];
        if (typeof stored !== "string") continue;
        const revealed = revealSecret(stored, secureStorage);
        value[key] = revealed.value;
        if (stored.trim() && !revealed.protected) protectedSecrets = false;
    }
    return { value, protected: protectedSecrets };
}

export function withStoredCredentials(
    row: Record<string, unknown> | null,
    secureStorage: SecureStorage,
): Record<string, unknown> | null {
    if (!row) return null;
    return inspectStoredCredentials(row, secureStorage).value;
}

export function persistCredentialRow(
    creds: { [key: string]: unknown },
    secureStorage: SecureStorage,
): Record<string, unknown> {
    const output = { ...creds };
    const hasSecret = CREDENTIAL_KEYS.some((key) => {
        const value = output[key];
        return typeof value === "string" && Boolean(value.trim());
    });
    if (hasSecret && !isSecureStorageSuitable(secureStorage)) {
        throw new Error("Secure credential storage is unavailable");
    }
    for (const key of CREDENTIAL_KEYS) {
        const value = output[key];
        if (typeof value === "string" && value.trim()) {
            output[key] = secureStorage.encryptString(value).toString("base64");
        }
    }
    return output;
}

export function migrateCredentialRow(
    value: unknown,
    manager: DatabaseManager,
    secureStorage: SecureStorage,
): { status: "imported" | "updated" | "identical" | "skipped" } {
    if (!isSecureStorageSuitable(secureStorage)) {
        return { status: "skipped" };
    }
    const creds = parseAiCredentials(value);
    const existingRow = manager.db.prepare("SELECT * FROM aiCredentials WHERE adapterId = ?").get(creds.adapterId) as
        | Record<string, unknown>
        | undefined;
    const inspected = existingRow ? inspectStoredCredentials(existingRow, secureStorage) : null;
    const existing = inspected?.value ?? null;
    const comparableKeys = [...CREDENTIAL_KEYS, "expiresAt", "baseUrl", "accountId"] as const;
    const sameSecrets = existing && comparableKeys.every((key) => (existing[key] ?? null) === (creds[key] ?? null));
    if (sameSecrets && inspected?.protected) return { status: "identical" };

    const sourceTime = Date.parse(String(creds.updatedAt ?? ""));
    const destinationTime = Date.parse(String(existing?.updatedAt ?? ""));
    const sourceIsNewer =
        Number.isFinite(sourceTime) && Number.isFinite(destinationTime) && sourceTime > destinationTime;
    if (existing && inspected?.protected && !sourceIsNewer) {
        return { status: "skipped" };
    }

    const winner = existing && !sourceIsNewer ? existing : creds;
    const now = new Date().toISOString();
    const encrypted = persistCredentialRow(winner, secureStorage);
    manager.db
        .prepare(
            `
        INSERT OR REPLACE INTO aiCredentials
          (adapterId, accessToken, refreshToken, expiresAt, apiKey, baseUrl, accountId, idToken, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM aiCredentials WHERE adapterId = ?), ?), ?)
      `,
        )
        .run(
            winner.adapterId,
            encrypted.accessToken ?? null,
            encrypted.refreshToken ?? null,
            winner.expiresAt ?? null,
            encrypted.apiKey ?? null,
            winner.baseUrl ?? null,
            winner.accountId ?? null,
            encrypted.idToken ?? null,
            winner.adapterId,
            winner.createdAt instanceof Date ? winner.createdAt.toISOString() : (winner.createdAt ?? now),
            winner.updatedAt instanceof Date ? winner.updatedAt.toISOString() : (winner.updatedAt ?? now),
        );
    return { status: existing ? "updated" : "imported" };
}
