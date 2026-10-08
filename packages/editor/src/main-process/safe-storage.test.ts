import type { safeStorage } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { persistCredentialRow, prepareCredentialStorage, withStoredCredentials } from "./credential-storage";
import { createSecureStorage } from "./safe-storage";

const native = {
    isEncryptionAvailable: vi.fn(() => false),
    isAsyncEncryptionAvailable: vi.fn(async () => true),
    getSelectedStorageBackend: vi.fn<typeof safeStorage.getSelectedStorageBackend>(() => "gnome_libsecret"),
    encryptString: vi.fn((value: string) => Buffer.from("v10:" + value)),
    encryptStringAsync: vi.fn(async (value: string) => Buffer.from("v11:" + value)),
    decryptString: vi.fn((value: Buffer) => value.toString().slice(4)),
    decryptStringAsync: vi.fn(async (value: Buffer) => ({
        result: value.toString().slice(4),
        shouldReEncrypt: value.toString().startsWith("v10:"),
    })),
};

beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    native.isEncryptionAvailable.mockReturnValue(false);
    native.isAsyncEncryptionAvailable.mockResolvedValue(true);
    native.getSelectedStorageBackend.mockReturnValue("gnome_libsecret");
    native.encryptString.mockImplementation((value) => Buffer.from("v10:" + value));
    native.encryptStringAsync.mockImplementation(async (value) => Buffer.from("v11:" + value));
    native.decryptString.mockImplementation((value) => value.toString().slice(4));
    native.decryptStringAsync.mockImplementation(async (value) => ({
        result: value.toString().slice(4),
        shouldReEncrypt: value.toString().startsWith("v10:"),
    }));
});

afterEach(() => vi.restoreAllMocks());

describe("secure storage backend", () => {
    it("lets the user retry after encryption availability was false", async () => {
        native.isAsyncEncryptionAvailable.mockResolvedValueOnce(false);
        const storage = createSecureStorage(native, "darwin");
        await expect(prepareCredentialStorage(storage)).rejects.toThrow("Secure credential storage is unavailable");
        await prepareCredentialStorage(storage);
        expect(native.isAsyncEncryptionAvailable).toHaveBeenCalledTimes(2);
    });

    it("lets the user retry after a rejected native availability check", async () => {
        native.isAsyncEncryptionAvailable.mockRejectedValueOnce(new Error("Temporarily unavailable"));
        const storage = createSecureStorage(native, "darwin");
        await expect(prepareCredentialStorage(storage)).rejects.toThrow("Secure credential storage is unavailable");
        await prepareCredentialStorage(storage);
        expect(native.isAsyncEncryptionAvailable).toHaveBeenCalledTimes(2);
    });

    it("supports macOS async encryption when the old synchronous check is false", async () => {
        await expect(prepareCredentialStorage(native)).rejects.toThrow("Secure credential storage is unavailable");
        const storage = createSecureStorage(native, "darwin");
        await prepareCredentialStorage(storage);
        const encrypted = await persistCredentialRow({ adapterId: "openai", apiKey: "synthetic-key" }, storage);
        expect(encrypted).toEqual({
            adapterId: "openai",
            apiKey: Buffer.from("v11:synthetic-key").toString("base64"),
        });
        expect(await withStoredCredentials(encrypted, storage)).toEqual({
            adapterId: "openai",
            apiKey: "synthetic-key",
        });
        expect(native.encryptString).not.toHaveBeenCalled();
        expect(native.decryptString).not.toHaveBeenCalled();
        expect(native.getSelectedStorageBackend).not.toHaveBeenCalled();
    });

    it("reads legacy ciphertext without silently rewriting stored credentials", async () => {
        const row = { adapterId: "openai", apiKey: Buffer.from("v10:legacy-key").toString("base64") };
        expect(await withStoredCredentials(row, createSecureStorage(native, "darwin"))).toEqual({
            adapterId: "openai",
            apiKey: "legacy-key",
        });
        expect(row.apiKey).toBe(Buffer.from("v10:legacy-key").toString("base64"));
        expect(native.encryptStringAsync).not.toHaveBeenCalled();
    });

    it("retains encrypted synchronous compatibility when async availability is false", async () => {
        native.isAsyncEncryptionAvailable.mockResolvedValue(false);
        native.isEncryptionAvailable.mockReturnValue(true);
        await prepareCredentialStorage(createSecureStorage(native, "darwin"));
        expect(native.encryptString).toHaveBeenCalledExactlyOnceWith("Write Me secure storage check");
        expect(native.encryptStringAsync).not.toHaveBeenCalled();
    });

    it("uses legacy decryption when an available legacy backend owns the ciphertext", async () => {
        native.isEncryptionAvailable.mockReturnValue(true);
        native.decryptStringAsync.mockRejectedValue(new Error("Legacy cipher"));
        const row = { apiKey: Buffer.from("v10:legacy-key").toString("base64") };
        expect(await withStoredCredentials(row, createSecureStorage(native, "darwin"))).toEqual({
            apiKey: "legacy-key",
        });
        expect(native.decryptString).toHaveBeenCalledExactlyOnceWith(Buffer.from("v10:legacy-key"));
    });

    it("never returns encrypted bytes as provider credentials after a decryption failure", async () => {
        native.decryptStringAsync.mockRejectedValue(new Error("Key unavailable"));
        const row = { apiKey: Buffer.from("v11:unreadable").toString("base64") };
        expect(await withStoredCredentials(row, createSecureStorage(native, "darwin"))).toBeNull();
        expect(row.apiKey).toBe(Buffer.from("v11:unreadable").toString("base64"));
    });

    it("does not bypass an async encryption error with another encryption backend", async () => {
        native.encryptStringAsync.mockRejectedValue(new Error("Access denied"));
        native.isEncryptionAvailable.mockReturnValue(true);
        await expect(prepareCredentialStorage(createSecureStorage(native, "darwin"))).rejects.toThrow("Access denied");
        expect(native.encryptString).not.toHaveBeenCalled();
    });

    it("rejects a bad async round trip", async () => {
        native.decryptStringAsync.mockResolvedValue({ result: "wrong", shouldReEncrypt: false });
        await expect(prepareCredentialStorage(createSecureStorage(native, "darwin"))).rejects.toThrow(
            "Secure credential storage is unavailable",
        );
    });

    it("blocks persistence when neither encrypted backend is available", async () => {
        native.isAsyncEncryptionAvailable.mockResolvedValue(false);
        const storage = createSecureStorage(native, "darwin");
        await expect(persistCredentialRow({ apiKey: "synthetic-key" }, storage)).rejects.toThrow(
            "Secure credential storage is unavailable",
        );
        expect(native.encryptStringAsync).not.toHaveBeenCalled();
        expect(native.encryptString).not.toHaveBeenCalled();
    });

    it.each(["win32", "linux"] as const)("preserves secure synchronous storage on %s", async (platform) => {
        native.isEncryptionAvailable.mockReturnValue(true);
        await prepareCredentialStorage(createSecureStorage(native, platform));
        expect(native.encryptString).toHaveBeenCalledExactlyOnceWith("Write Me secure storage check");
        expect(native.isAsyncEncryptionAvailable).not.toHaveBeenCalled();
    });

    it.each(["basic_text", "unknown"] as const)("rejects Linux %s even if the native flag is true", async (backend) => {
        native.isEncryptionAvailable.mockReturnValue(true);
        native.getSelectedStorageBackend.mockReturnValue(backend);
        await expect(prepareCredentialStorage(createSecureStorage(native, "linux"))).rejects.toThrow(
            "Secure credential storage is unavailable",
        );
        expect(native.encryptString).not.toHaveBeenCalled();
        expect(native.encryptStringAsync).not.toHaveBeenCalled();
    });
});
