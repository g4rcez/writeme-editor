import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareCredentialStorage } from "./credential-storage";

const originalPlatform = process.platform;
const storage = {
    isEncryptionAvailable: vi.fn(() => true),
    getSelectedStorageBackend: vi.fn(() => "gnome_libsecret"),
    encryptString: vi.fn((value: string) => Buffer.from("encrypted:" + value)),
    decryptString: vi.fn((value: Buffer) => value.toString().slice("encrypted:".length)),
};

beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(process, "platform", { value: "darwin" });
    storage.isEncryptionAvailable.mockReturnValue(true);
    storage.getSelectedStorageBackend.mockReturnValue("gnome_libsecret");
    storage.encryptString.mockImplementation((value) => Buffer.from("encrypted:" + value));
    storage.decryptString.mockImplementation((value) => value.toString().slice("encrypted:".length));
});

afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
});

describe("prepareCredentialStorage", () => {
    it("verifies an encrypted round trip without provider credentials or database writes", async () => {
        await prepareCredentialStorage(storage);
        expect(storage.encryptString).toHaveBeenCalledExactlyOnceWith("Write Me secure storage check");
        expect(storage.decryptString).toHaveBeenCalledExactlyOnceWith(
            Buffer.from("encrypted:Write Me secure storage check"),
        );
        expect(storage.getSelectedStorageBackend).not.toHaveBeenCalled();
    });

    it("refuses unavailable encryption before using a probe", async () => {
        storage.isEncryptionAvailable.mockReturnValue(false);
        await expect(prepareCredentialStorage(storage)).rejects.toThrow("Secure credential storage is unavailable");
        expect(storage.encryptString).not.toHaveBeenCalled();
    });

    it.each(["basic_text", "unknown"])("refuses insecure Linux storage %s", async (backend) => {
        Object.defineProperty(process, "platform", { value: "linux" });
        storage.getSelectedStorageBackend.mockReturnValue(backend);
        await expect(prepareCredentialStorage(storage)).rejects.toThrow("Secure credential storage is unavailable");
        expect(storage.encryptString).not.toHaveBeenCalled();
    });

    it("accepts a secure Linux backend", async () => {
        Object.defineProperty(process, "platform", { value: "linux" });
        await prepareCredentialStorage(storage);
        expect(storage.getSelectedStorageBackend).toHaveBeenCalledOnce();
        expect(storage.decryptString).toHaveBeenCalledOnce();
    });

    it("refuses a failed availability check", async () => {
        storage.isEncryptionAvailable.mockImplementation(() => {
            throw new Error("Keychain locked");
        });
        await expect(prepareCredentialStorage(storage)).rejects.toThrow("Secure credential storage is unavailable");
        expect(storage.encryptString).not.toHaveBeenCalled();
    });

    it("preserves encryption and decryption errors", async () => {
        storage.encryptString.mockImplementation(() => {
            throw new Error("Access denied");
        });
        await expect(prepareCredentialStorage(storage)).rejects.toThrow("Access denied");
        storage.encryptString.mockReturnValue(Buffer.from("encrypted:probe"));
        storage.decryptString.mockImplementation(() => {
            throw new Error("Access denied");
        });
        await expect(prepareCredentialStorage(storage)).rejects.toThrow("Access denied");
    });

    it("rejects an invalid encrypted round trip", async () => {
        storage.decryptString.mockReturnValue("wrong result");
        await expect(prepareCredentialStorage(storage)).rejects.toThrow("Secure credential storage is unavailable");
    });
});
