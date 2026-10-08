import { ipcMain, safeStorage } from "electron";
import type { DatabaseManager } from "../main-process/database";
import { migrateCredentialRow, persistCredentialRow, withStoredCredentials } from "../main-process/credential-storage";
import { parseAiCredentials } from "../main-process/database-schema";
import { createSecureStorage } from "../main-process/safe-storage";

export function registerAICredentialHandlers(getManager: () => DatabaseManager): void {
    const pending = new Map<string, Promise<unknown>>();
    const enqueue = <T>(adapterId: string, operation: () => Promise<T>): Promise<T> => {
        const previous = pending.get(adapterId) ?? Promise.resolve();
        const result = previous.then(operation, operation);
        pending.set(adapterId, result);
        const cleanup = (): void => {
            if (pending.get(adapterId) === result) pending.delete(adapterId);
        };
        void result.then(cleanup, cleanup);
        return result;
    };

    ipcMain.handle("ai:save-credentials", (_event, value: unknown) => {
        const creds = parseAiCredentials(value);
        return enqueue(creds.adapterId, async () => {
            try {
                const encrypted = await persistCredentialRow(creds, createSecureStorage(safeStorage));
                const now = new Date().toISOString();
                getManager()
                    .db.prepare(`
                    INSERT OR REPLACE INTO aiCredentials
                      (adapterId, accessToken, refreshToken, expiresAt, apiKey, baseUrl, accountId, idToken, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM aiCredentials WHERE adapterId = ?), ?), ?)
                `)
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
                        now,
                        now,
                    );
                return { success: true };
            } catch (error: unknown) {
                console.error("Error in ai:save-credentials:", error);
                throw error;
            }
        });
    });

    ipcMain.handle("ai:migrate-credentials", (_event, value: unknown) => {
        const creds = parseAiCredentials(value);
        return enqueue(creds.adapterId, () =>
            migrateCredentialRow(creds, getManager(), createSecureStorage(safeStorage)),
        );
    });

    ipcMain.handle("ai:load-credentials", (_event, adapterId: string) =>
        enqueue(adapterId, async () => {
            try {
                const row = getManager()
                    .db.prepare("SELECT * FROM aiCredentials WHERE adapterId = ?")
                    .get(adapterId) as Record<string, unknown> | undefined;
                return await withStoredCredentials(row ?? null, createSecureStorage(safeStorage));
            } catch (error: unknown) {
                console.error("Error in ai:load-credentials:", error);
                return null;
            }
        }),
    );

    ipcMain.handle("ai:clear-credentials", (_event, adapterId: string) =>
        enqueue(adapterId, async () => {
            try {
                getManager().db.prepare("DELETE FROM aiCredentials WHERE adapterId = ?").run(adapterId);
                return { success: true };
            } catch (error: unknown) {
                console.error("Error in ai:clear-credentials:", error);
                throw error;
            }
        }),
    );
}
