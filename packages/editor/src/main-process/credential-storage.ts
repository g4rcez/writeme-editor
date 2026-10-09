import type { DatabaseManager } from "./database";
import { parseAiCredentials } from "./database-schema";

const CREDENTIAL_KEYS = ["accessToken", "refreshToken", "apiKey", "idToken"] as const;

export type SecureStorage = {
    isEncryptionAvailable(): boolean | Promise<boolean>;
    getSelectedStorageBackend(): string;
    encryptString(value: string): Buffer | Promise<Buffer>;
    decryptString(value: Buffer): string | Promise<string>;
};

type RevealedSecret = {
    value: string | null;
    protected: boolean;
};

type CredentialMigrationResult = { status: "imported" | "updated" | "identical" | "skipped" };

async function isSecureStorageSuitable(secureStorage: SecureStorage): Promise<boolean> {
    try {
        if (!(await secureStorage.isEncryptionAvailable())) return false;
        if (process.platform !== "linux") return true;
        const backend = secureStorage.getSelectedStorageBackend();
        return backend !== "basic_text" && backend !== "unknown";
    } catch {
        return false;
    }
}

async function revealSecret(secret: string | null, secureStorage: SecureStorage): Promise<RevealedSecret> {
    if (!secret) return { value: null, protected: true };
    if (!(await secureStorage.isEncryptionAvailable())) return { value: secret, protected: false };

    try {
        return {
            value: await secureStorage.decryptString(Buffer.from(secret, "base64")),
            protected: true,
        };
    } catch {
        return { value: secret, protected: false };
    }
}

async function inspectStoredCredentials(
    row: Record<string, unknown>,
    secureStorage: SecureStorage,
): Promise<{ value: Record<string, unknown>; protected: boolean; unreadable: boolean }> {
    const value: Record<string, unknown> = { ...row };
    let protectedSecrets = true;
    let unreadable = false;
    for (const key of CREDENTIAL_KEYS) {
        const stored = row[key];
        if (typeof stored !== "string") continue;
        const revealed = await revealSecret(stored, secureStorage);
        value[key] = revealed.value;
        if (stored.trim() && !revealed.protected) {
            protectedSecrets = false;
            unreadable = true;
        }
    }
    return { value, protected: protectedSecrets, unreadable };
}

export async function withStoredCredentials(
    row: Record<string, unknown> | null,
    secureStorage: SecureStorage,
): Promise<Record<string, unknown> | null> {
    if (!row) return null;
    const inspected = await inspectStoredCredentials(row, secureStorage);
    return inspected.protected ? inspected.value : null;
}

export async function persistCredentialRow(
    creds: { [key: string]: unknown },
    secureStorage: SecureStorage,
): Promise<Record<string, unknown>> {
    const output = { ...creds };
    const hasSecret = CREDENTIAL_KEYS.some((key) => {
        const value = output[key];
        return typeof value === "string" && Boolean(value.trim());
    });
    if (hasSecret && !(await isSecureStorageSuitable(secureStorage))) {
        throw new Error("Secure credential storage is unavailable");
    }
    for (const key of CREDENTIAL_KEYS) {
        const value = output[key];
        if (typeof value === "string" && value.trim()) {
            output[key] = (await secureStorage.encryptString(value)).toString("base64");
        }
    }
    return output;
}

export async function prepareCredentialStorage(secureStorage: SecureStorage): Promise<void> {
    const probe = "Write Me secure storage check";
    const encrypted = await persistCredentialRow({ apiKey: probe }, secureStorage);
    if (
        typeof encrypted.apiKey !== "string" ||
        (await secureStorage.decryptString(Buffer.from(encrypted.apiKey, "base64"))) !== probe
    ) {
        throw new Error("Secure credential storage is unavailable");
    }
}

export async function migrateCredentialRow(
    value: unknown,
    manager: DatabaseManager,
    secureStorage: SecureStorage,
): Promise<CredentialMigrationResult> {
    if (!(await isSecureStorageSuitable(secureStorage))) {
        return { status: "skipped" };
    }
    const creds = parseAiCredentials(value);
    const existingRow = manager.db.prepare("SELECT * FROM aiCredentials WHERE adapterId = ?").get(creds.adapterId) as
        | Record<string, unknown>
        | undefined;
    const inspected = existingRow ? await inspectStoredCredentials(existingRow, secureStorage) : null;
    const existing = inspected?.value ?? null;
    const comparableKeys = [...CREDENTIAL_KEYS, "expiresAt", "baseUrl", "accountId"] as const;
    const sameSecrets = existing && comparableKeys.every((key) => (existing[key] ?? null) === (creds[key] ?? null));
    if (sameSecrets && inspected?.protected) return { status: "identical" };
    if (inspected?.unreadable && !sameSecrets) return { status: "skipped" };

    const sourceTime = Date.parse(String(creds.updatedAt ?? ""));
    const destinationTime = Date.parse(String(existing?.updatedAt ?? ""));
    const sourceIsNewer =
        Number.isFinite(sourceTime) && Number.isFinite(destinationTime) && sourceTime > destinationTime;
    if (existing && inspected?.protected && !sourceIsNewer) {
        return { status: "skipped" };
    }

    const matchingUnreadableCredential = inspected?.unreadable === true && sameSecrets === true;
    const winner = existing && (!sourceIsNewer || matchingUnreadableCredential) ? existing : creds;
    const now = new Date().toISOString();
    const encrypted = await persistCredentialRow(winner, secureStorage);
    return manager.db
        .transaction((): CredentialMigrationResult => {
            const currentRow = manager.db
                .prepare("SELECT * FROM aiCredentials WHERE adapterId = ?")
                .get(creds.adapterId) as Record<string, unknown> | undefined;
            if (
                Boolean(existingRow) !== Boolean(currentRow) ||
                (existingRow && !Object.entries(existingRow).every(([key, value]) => currentRow?.[key] === value))
            ) {
                return { status: "skipped" };
            }
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
        })
        .immediate();
}
