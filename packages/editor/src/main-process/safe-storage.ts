import type { safeStorage } from "electron";
import type { SecureStorage } from "./credential-storage";

type NativeStorage = Pick<
    typeof safeStorage,
    | "isEncryptionAvailable"
    | "isAsyncEncryptionAvailable"
    | "getSelectedStorageBackend"
    | "encryptString"
    | "encryptStringAsync"
    | "decryptString"
    | "decryptStringAsync"
>;

export function createSecureStorage(
    storage: NativeStorage,
    platform: NodeJS.Platform = process.platform,
): SecureStorage {
    let backend: Promise<"async" | "sync" | null> | undefined;
    const selectBackend = (): Promise<"async" | "sync" | null> => {
        backend ??= (async () => {
            if (platform === "darwin" && (await storage.isAsyncEncryptionAvailable())) return "async";
            if (!storage.isEncryptionAvailable()) return null;
            if (platform === "linux") {
                const selected = storage.getSelectedStorageBackend();
                if (selected === "basic_text" || selected === "unknown") return null;
            }
            return "sync";
        })().then(
            (selected) => {
                if (selected === null) backend = undefined;
                return selected;
            },
            (error: unknown) => {
                backend = undefined;
                throw error;
            },
        );
        return backend;
    };

    return {
        isEncryptionAvailable: async () => (await selectBackend()) !== null,
        getSelectedStorageBackend: () => storage.getSelectedStorageBackend(),
        encryptString: async (value) => {
            const selected = await selectBackend();
            if (selected === "async") return storage.encryptStringAsync(value);
            if (selected === "sync") return storage.encryptString(value);
            throw new Error("Secure credential storage is unavailable");
        },
        decryptString: async (value) => {
            const selected = await selectBackend();
            if (selected === "async") {
                try {
                    return (await storage.decryptStringAsync(value)).result;
                } catch (error: unknown) {
                    if (storage.isEncryptionAvailable()) return storage.decryptString(value);
                    throw error;
                }
            }
            if (selected === "sync") return storage.decryptString(value);
            throw new Error("Secure credential storage is unavailable");
        },
    };
}
