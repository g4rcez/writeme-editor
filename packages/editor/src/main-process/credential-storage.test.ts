import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { getPath: () => tmpdir() } }));

import { migrateCredentialRow, persistCredentialRow } from "./credential-storage";
import { DatabaseManager } from "./database";

let directory: string;
let manager: DatabaseManager;
const secureStorage = {
    isEncryptionAvailable: vi.fn(() => true),
    getSelectedStorageBackend: vi.fn(() => "gnome_libsecret"),
    encryptString: vi.fn<(value: string) => Buffer | Promise<Buffer>>((value) => Buffer.from(`encrypted:${value}`)),
    decryptString: vi.fn((value: Buffer) => {
        const stored = value.toString();
        if (!stored.startsWith("encrypted:")) throw new Error("Not encrypted");
        return stored.replace(/^encrypted:/, "");
    }),
};

beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "writeme-credentials-"));
    manager = new DatabaseManager(path.join(directory, "test.sqlite"));
    secureStorage.isEncryptionAvailable.mockReturnValue(true);
    secureStorage.isEncryptionAvailable.mockClear();
    secureStorage.getSelectedStorageBackend.mockReturnValue("gnome_libsecret");
    secureStorage.getSelectedStorageBackend.mockClear();
    secureStorage.encryptString.mockClear();
    secureStorage.decryptString.mockClear();
});

afterEach(async () => {
    manager?.close();
    await rm(directory, { recursive: true, force: true });
    vi.restoreAllMocks();
});

describe("credential migration", () => {
    it("rejects credential persistence instead of returning plaintext when encryption is unavailable", async () => {
        const source = { adapterId: "openai", apiKey: "secret" };
        secureStorage.isEncryptionAvailable.mockReturnValue(false);

        await expect(persistCredentialRow(source, secureStorage)).rejects.toThrow(
            "Secure credential storage is unavailable",
        );
        expect(secureStorage.encryptString).not.toHaveBeenCalled();
        expect(source).toEqual({ adapterId: "openai", apiKey: "secret" });
    });

    it("retains the source credential when encryption is unavailable", async () => {
        const source = { adapterId: "openai", apiKey: "secret" };
        secureStorage.isEncryptionAvailable.mockReturnValue(false);

        expect(await migrateCredentialRow(source, manager, secureStorage)).toEqual({
            status: "skipped",
        });
        expect(
            manager.db.prepare("SELECT * FROM aiCredentials WHERE adapterId = ?").get(source.adapterId),
        ).toBeUndefined();
        expect(source.apiKey).toBe("secret");
    });

    it("uses available secure storage without backend inspection on non-Linux platforms", async () => {
        vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
        secureStorage.getSelectedStorageBackend.mockImplementation(() => {
            throw new Error("backend should not be inspected");
        });

        const persisted = await persistCredentialRow({ adapterId: "openai", apiKey: "secret" }, secureStorage);

        expect(persisted.apiKey).toBe(Buffer.from("encrypted:secret").toString("base64"));
        expect(secureStorage.getSelectedStorageBackend).not.toHaveBeenCalled();
    });

    it.each(["basic_text", "unknown"])(
        "rejects Linux %s persistence and retains the migration source",
        async (backend) => {
            vi.spyOn(process, "platform", "get").mockReturnValue("linux");
            secureStorage.getSelectedStorageBackend.mockReturnValue(backend);
            const source = { adapterId: "openai", apiKey: "secret" };

            await expect(persistCredentialRow(source, secureStorage)).rejects.toThrow(
                "Secure credential storage is unavailable",
            );
            expect(await migrateCredentialRow(source, manager, secureStorage)).toEqual({ status: "skipped" });
            expect(
                manager.db.prepare("SELECT * FROM aiCredentials WHERE adapterId = ?").get(source.adapterId),
            ).toBeUndefined();
            expect(source.apiKey).toBe("secret");
            expect(secureStorage.encryptString).not.toHaveBeenCalled();
        },
    );

    it("fails closed when Linux storage backend inspection fails", async () => {
        vi.spyOn(process, "platform", "get").mockReturnValue("linux");
        secureStorage.getSelectedStorageBackend.mockImplementation(() => {
            throw new Error("backend unavailable");
        });
        const source = { adapterId: "openai", apiKey: "secret" };

        await expect(persistCredentialRow(source, secureStorage)).rejects.toThrow(
            "Secure credential storage is unavailable",
        );
        expect(await migrateCredentialRow(source, manager, secureStorage)).toEqual({ status: "skipped" });
        expect(manager.db.prepare("SELECT * FROM aiCredentials").all()).toEqual([]);
    });

    it("reports success only after writing with a secure Linux backend", async () => {
        vi.spyOn(process, "platform", "get").mockReturnValue("linux");
        const result = await migrateCredentialRow(
            {
                adapterId: "openai",
                apiKey: "secret",
                updatedAt: "2026-01-02T00:00:00.000Z",
            },
            manager,
            secureStorage,
        );
        const stored = manager.db.prepare("SELECT apiKey FROM aiCredentials WHERE adapterId = ?").get("openai") as {
            apiKey: string;
        };

        expect(result).toEqual({ status: "imported" });
        expect(stored.apiKey).toBe(Buffer.from("encrypted:secret").toString("base64"));
        expect(secureStorage.encryptString).toHaveBeenCalledWith("secret");
    });

    it("rewrites a matching plaintext credential before reporting success", async () => {
        const timestamp = "2026-01-02T00:00:00.000Z";
        manager.db
            .prepare("INSERT INTO aiCredentials (adapterId, apiKey, createdAt, updatedAt) VALUES (?, ?, ?, ?)")
            .run("openai", "secret", timestamp, timestamp);

        const result = await migrateCredentialRow(
            {
                adapterId: "openai",
                apiKey: "secret",
                createdAt: timestamp,
                updatedAt: timestamp,
            },
            manager,
            secureStorage,
        );
        const stored = manager.db
            .prepare("SELECT apiKey, createdAt FROM aiCredentials WHERE adapterId = ?")
            .get("openai") as { apiKey: string; createdAt: string };

        expect(result).toEqual({ status: "updated" });
        expect(stored).toEqual({
            apiKey: Buffer.from("encrypted:secret").toString("base64"),
            createdAt: timestamp,
        });
    });

    it("protects a differing plaintext destination without adopting an older source", async () => {
        const destinationCreatedAt = "2026-01-01T00:00:00.000Z";
        const destinationUpdatedAt = "2026-01-03T00:00:00.000Z";
        manager.db
            .prepare(
                `INSERT INTO aiCredentials
                  (adapterId, apiKey, baseUrl, accountId, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .run(
                "openai",
                "destination-secret",
                "https://destination.example",
                "destination-account",
                destinationCreatedAt,
                destinationUpdatedAt,
            );

        const result = await migrateCredentialRow(
            {
                adapterId: "openai",
                apiKey: "source-secret",
                baseUrl: "https://source.example",
                accountId: "source-account",
                createdAt: "2025-12-01T00:00:00.000Z",
                updatedAt: "2026-01-02T00:00:00.000Z",
            },
            manager,
            secureStorage,
        );
        const stored = manager.db
            .prepare(
                `SELECT adapterId, apiKey, baseUrl, accountId, createdAt, updatedAt
                 FROM aiCredentials WHERE adapterId = ?`,
            )
            .get("openai");

        expect(result).toEqual({ status: "updated" });
        expect(stored).toEqual({
            adapterId: "openai",
            apiKey: Buffer.from("encrypted:destination-secret").toString("base64"),
            baseUrl: "https://destination.example",
            accountId: "destination-account",
            createdAt: destinationCreatedAt,
            updatedAt: destinationUpdatedAt,
        });
        expect(secureStorage.encryptString).toHaveBeenCalledWith("destination-secret");
        expect(secureStorage.encryptString).not.toHaveBeenCalledWith("source-secret");
    });

    it("replaces a plaintext destination with a newer protected source", async () => {
        const destinationCreatedAt = "2026-01-01T00:00:00.000Z";
        manager.db
            .prepare(
                `INSERT INTO aiCredentials
                  (adapterId, apiKey, baseUrl, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?)`,
            )
            .run(
                "openai",
                "destination-secret",
                "https://destination.example",
                destinationCreatedAt,
                "2026-01-02T00:00:00.000Z",
            );

        const result = await migrateCredentialRow(
            {
                adapterId: "openai",
                apiKey: "source-secret",
                baseUrl: "https://source.example",
                createdAt: "2025-12-01T00:00:00.000Z",
                updatedAt: "2026-01-03T00:00:00.000Z",
            },
            manager,
            secureStorage,
        );
        const stored = manager.db
            .prepare("SELECT apiKey, baseUrl, createdAt, updatedAt FROM aiCredentials WHERE adapterId = ?")
            .get("openai");

        expect(result).toEqual({ status: "updated" });
        expect(stored).toEqual({
            apiKey: Buffer.from("encrypted:source-secret").toString("base64"),
            baseUrl: "https://source.example",
            createdAt: destinationCreatedAt,
            updatedAt: "2026-01-03T00:00:00.000Z",
        });
        expect(secureStorage.encryptString).toHaveBeenCalledWith("source-secret");
        expect(secureStorage.encryptString).not.toHaveBeenCalledWith("destination-secret");
    });

    it.each(["2025-01-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z"])(
        "retains unreadable encrypted credentials instead of treating ciphertext as plaintext (%s)",
        async (updatedAt) => {
            const encrypted = Buffer.from("v10:existing-secret").toString("base64");
            manager.db
                .prepare("INSERT INTO aiCredentials (adapterId, apiKey, createdAt, updatedAt) VALUES (?, ?, ?, ?)")
                .run("openai", encrypted, "2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z");
            const before = manager.db.prepare("SELECT * FROM aiCredentials").all();
            expect(
                await migrateCredentialRow(
                    {
                        adapterId: "openai",
                        apiKey: "source-secret",
                        updatedAt,
                    },
                    manager,
                    secureStorage,
                ),
            ).toEqual({ status: "skipped" });
            expect(manager.db.prepare("SELECT * FROM aiCredentials").all()).toEqual(before);
            expect(secureStorage.encryptString).not.toHaveBeenCalled();
        },
    );

    it("does not overwrite a destination changed while encryption was pending", async () => {
        manager.db
            .prepare("INSERT INTO aiCredentials (adapterId, apiKey, createdAt, updatedAt) VALUES (?, ?, ?, ?)")
            .run(
                "openai",
                Buffer.from("encrypted:old-key").toString("base64"),
                "2026-01-01T00:00:00.000Z",
                "2026-01-02T00:00:00.000Z",
            );
        let finish: (value: Buffer) => void = () => undefined;
        const encryption = new Promise<Buffer>((resolve) => {
            finish = resolve;
        });
        secureStorage.encryptString.mockReturnValueOnce(encryption);
        const migration = migrateCredentialRow(
            {
                adapterId: "openai",
                apiKey: "migration-key",
                updatedAt: "2026-01-03T00:00:00.000Z",
            },
            manager,
            secureStorage,
        );
        await vi.waitFor(() => expect(secureStorage.encryptString).toHaveBeenCalledOnce());
        manager.db
            .prepare("UPDATE aiCredentials SET apiKey = ?, updatedAt = ? WHERE adapterId = ?")
            .run(Buffer.from("encrypted:new-key").toString("base64"), "2026-01-04T00:00:00.000Z", "openai");
        const before = manager.db.prepare("SELECT * FROM aiCredentials").all();
        finish(Buffer.from("encrypted:migration-key"));
        expect(await migration).toEqual({ status: "skipped" });
        expect(manager.db.prepare("SELECT * FROM aiCredentials").all()).toEqual(before);
        expect(manager.db.inTransaction).toBe(false);
    });
});
