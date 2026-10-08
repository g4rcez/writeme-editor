import type { safeStorage } from "electron";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (event: unknown, value: unknown) => unknown;
const mocks = vi.hoisted(() => ({
    handlers: new Map<string, Handler>(),
    syncAvailable: vi.fn(() => false),
    asyncAvailable: vi.fn(async () => true),
    encrypt: vi.fn<typeof safeStorage.encryptStringAsync>(async (value) => Buffer.from("v11:" + value)),
    decrypt: vi.fn(async (value: Buffer) => ({ result: value.toString().slice(4), shouldReEncrypt: false })),
    syncEncrypt: vi.fn((value: string) => Buffer.from("v10:" + value)),
    syncDecrypt: vi.fn((value: Buffer) => value.toString().slice(4)),
}));

vi.mock("electron", () => ({
    app: { getPath: () => tmpdir() },
    ipcMain: {
        handle: (name: string, handler: Handler): void => {
            mocks.handlers.set(name, handler);
        },
    },
    safeStorage: {
        isEncryptionAvailable: mocks.syncAvailable,
        isAsyncEncryptionAvailable: mocks.asyncAvailable,
        encryptStringAsync: mocks.encrypt,
        decryptStringAsync: mocks.decrypt,
        encryptString: mocks.syncEncrypt,
        decryptString: mocks.syncDecrypt,
        getSelectedStorageBackend: () => "gnome_libsecret",
    },
}));

import { DatabaseManager } from "../main-process/database";
import { registerAICredentialHandlers } from "./ai-storage.ipc";

let directory: string;
let manager: DatabaseManager;

function invoke(name: string, value: unknown): Promise<unknown> {
    const handler = mocks.handlers.get(name);
    if (!handler) throw new Error("Handler not registered");
    return Promise.resolve(handler(undefined, value));
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((complete) => {
        resolve = complete;
    });
    return { promise, resolve };
}

beforeEach(async () => {
    vi.resetAllMocks();
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    mocks.handlers.clear();
    mocks.syncAvailable.mockReturnValue(false);
    mocks.asyncAvailable.mockResolvedValue(true);
    mocks.encrypt.mockImplementation(async (value) => Buffer.from("v11:" + value));
    mocks.decrypt.mockImplementation(async (value) => ({ result: value.toString().slice(4), shouldReEncrypt: false }));
    mocks.syncEncrypt.mockImplementation((value) => Buffer.from("v10:" + value));
    mocks.syncDecrypt.mockImplementation((value) => value.toString().slice(4));
    directory = await mkdtemp(path.join(tmpdir(), "writeme-ai-storage-"));
    manager = new DatabaseManager(path.join(directory, "test.sqlite"));
    registerAICredentialHandlers(() => manager);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
    manager?.close();
    await rm(directory, { recursive: true, force: true });
    vi.restoreAllMocks();
});

describe("AI credential IPC", () => {
    it("saves encrypted secrets and returns decrypted credentials through the existing API", async () => {
        const credentials = {
            adapterId: "openai",
            apiKey: "synthetic-key",
            accessToken: "synthetic-access",
            refreshToken: "synthetic-refresh",
            idToken: "synthetic-id",
            baseUrl: "https://api.openai.com",
            accountId: "synthetic-account",
        };
        expect(await invoke("ai:save-credentials", credentials)).toEqual({ success: true });
        const stored = manager.db.prepare("SELECT * FROM aiCredentials WHERE adapterId = ?").get("openai");
        expect(stored).toMatchObject({
            apiKey: Buffer.from("v11:synthetic-key").toString("base64"),
            accessToken: Buffer.from("v11:synthetic-access").toString("base64"),
            refreshToken: Buffer.from("v11:synthetic-refresh").toString("base64"),
            idToken: Buffer.from("v11:synthetic-id").toString("base64"),
        });
        expect(await invoke("ai:load-credentials", "openai")).toMatchObject(credentials);
        expect(mocks.syncEncrypt).not.toHaveBeenCalled();
    });

    it("waits for encryption before inserting a credential row", async () => {
        const encryption = deferred<Buffer>();
        mocks.encrypt.mockReturnValueOnce(encryption.promise);
        const save = invoke("ai:save-credentials", { adapterId: "openai", apiKey: "synthetic-key" });
        await vi.waitFor(() => expect(mocks.encrypt).toHaveBeenCalledOnce());
        expect(manager.db.prepare("SELECT * FROM aiCredentials").all()).toEqual([]);
        encryption.resolve(Buffer.from("v11:synthetic-key"));
        expect(await save).toEqual({ success: true });
    });

    it("does not let an unfinished save recreate credentials after disconnect", async () => {
        const encryption = deferred<Buffer>();
        mocks.encrypt.mockReturnValueOnce(encryption.promise);
        const save = invoke("ai:save-credentials", { adapterId: "openai", apiKey: "synthetic-key" });
        await vi.waitFor(() => expect(mocks.encrypt).toHaveBeenCalledOnce());
        const clear = invoke("ai:clear-credentials", "openai");
        encryption.resolve(Buffer.from("v11:synthetic-key"));
        expect(await save).toEqual({ success: true });
        expect(await clear).toEqual({ success: true });
        expect(await invoke("ai:load-credentials", "openai")).toBeNull();
        expect(manager.db.prepare("SELECT * FROM aiCredentials").all()).toEqual([]);
    });

    it("retains the newest save when multiple writes are pending", async () => {
        const encryption = deferred<Buffer>();
        mocks.encrypt.mockReturnValueOnce(encryption.promise);
        const first = invoke("ai:save-credentials", { adapterId: "openai", apiKey: "first-key" });
        await vi.waitFor(() => expect(mocks.encrypt).toHaveBeenCalledOnce());
        const second = invoke("ai:save-credentials", { adapterId: "openai", apiKey: "second-key" });
        encryption.resolve(Buffer.from("v11:first-key"));
        await Promise.all([first, second]);
        expect(await invoke("ai:load-credentials", "openai")).toMatchObject({ apiKey: "second-key" });
    });

    it("keeps provider queues independent", async () => {
        const encryption = deferred<Buffer>();
        mocks.encrypt.mockReturnValueOnce(encryption.promise);
        const first = invoke("ai:save-credentials", { adapterId: "openai", apiKey: "first-key" });
        await vi.waitFor(() => expect(mocks.encrypt).toHaveBeenCalledOnce());
        expect(await invoke("ai:save-credentials", { adapterId: "anthropic", apiKey: "other-key" })).toEqual({
            success: true,
        });
        expect(await invoke("ai:load-credentials", "anthropic")).toMatchObject({ apiKey: "other-key" });
        encryption.resolve(Buffer.from("v11:first-key"));
        await first;
    });

    it("preserves existing credentials when encryption fails and permits a later retry", async () => {
        await invoke("ai:save-credentials", { adapterId: "openai", apiKey: "existing-key" });
        const stored = manager.db.prepare("SELECT * FROM aiCredentials").all();
        mocks.encrypt.mockRejectedValueOnce(new Error("Access denied"));
        await expect(invoke("ai:save-credentials", { adapterId: "openai", apiKey: "replacement" })).rejects.toThrow(
            "Access denied",
        );
        expect(manager.db.prepare("SELECT * FROM aiCredentials").all()).toEqual(stored);
        expect(await invoke("ai:save-credentials", { adapterId: "openai", apiKey: "retry-key" })).toEqual({
            success: true,
        });
        expect(await invoke("ai:load-credentials", "openai")).toMatchObject({ apiKey: "retry-key" });
    });

    it("returns no credentials instead of leaking ciphertext when decryption fails", async () => {
        await invoke("ai:save-credentials", { adapterId: "openai", apiKey: "existing-key" });
        const stored = manager.db.prepare("SELECT * FROM aiCredentials").all();
        mocks.decrypt.mockRejectedValueOnce(new Error("Key unavailable"));
        expect(await invoke("ai:load-credentials", "openai")).toBeNull();
        expect(manager.db.prepare("SELECT * FROM aiCredentials").all()).toEqual(stored);
    });

    it("does not write plaintext when both secure backends are unavailable", async () => {
        mocks.asyncAvailable.mockResolvedValue(false);
        await expect(invoke("ai:save-credentials", { adapterId: "openai", apiKey: "synthetic-key" })).rejects.toThrow(
            "Secure credential storage is unavailable",
        );
        expect(manager.db.prepare("SELECT * FROM aiCredentials").all()).toEqual([]);
        expect(mocks.encrypt).not.toHaveBeenCalled();
        expect(mocks.syncEncrypt).not.toHaveBeenCalled();
    });

    it("migrates legacy input with async encryption without losing source timestamps", async () => {
        expect(
            await invoke("ai:migrate-credentials", {
                adapterId: "openai",
                apiKey: "legacy-key",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-02T00:00:00.000Z",
            }),
        ).toEqual({ status: "imported" });
        expect(await invoke("ai:load-credentials", "openai")).toMatchObject({
            apiKey: "legacy-key",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
        });
    });
});
