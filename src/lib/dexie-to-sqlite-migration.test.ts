import { beforeEach, describe, expect, it, vi } from "vitest";

const { collectionRecords, deleteDexie, table, credentialsToArray } = vi.hoisted(() => {
    const records = new Map<string, unknown[]>();
    return {
        collectionRecords: records,
        deleteDexie: vi.fn(),
        table: vi.fn((name: string) => ({
            toArray: () => Promise.resolve(records.get(name) ?? []),
        })),
        credentialsToArray: vi.fn<() => Promise<unknown[]>>(() => Promise.resolve([])),
    };
});

vi.mock("../store/repositories/browser/dexie-db", () => ({
    db: {
        table,
        aiCredentials: { toArray: credentialsToArray },
        delete: deleteDexie,
    },
}));
vi.mock("./is-electron", () => ({ isElectron: () => true }));

import { migrateDexieToSqlite } from "./dexie-to-sqlite-migration";

const expectedCollections = [
    "notes",
    "projects",
    "tabs",
    "hashtags",
    "settings",
    "scripts",
    "noteGroups",
    "noteGroupMembers",
    "aiConfigs",
    "aiChats",
    "aiMessages",
    "views",
    "cursorPositions",
    "terminalSessions",
];

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    collectionRecords.clear();
    Object.defineProperty(window, "electronAPI", {
        configurable: true,
        value: {
            db: {
                migrateCollection: vi.fn(async (_name: string, records: unknown[]) => ({
                    found: records.length,
                    imported: records.length,
                    updated: 0,
                    identical: 0,
                    skipped: 0,
                })),
                verifyCollection: vi.fn(async (_name: string, records: unknown[]) => ({
                    sourceCount: records.length,
                    destinationCount: records.length,
                    matched: records.length,
                })),
            },
            ai: {
                migrateCredentials: vi.fn(async () => ({ status: "imported" })),
            },
        },
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);
});

describe("Dexie to SQLite migration", () => {
    it("migrates every approved store before marking the migration verified", async () => {
        for (const name of expectedCollections) collectionRecords.set(name, [{ id: `${name}-id` }]);

        await migrateDexieToSqlite();

        expect(table.mock.calls.map(([name]) => name)).toEqual(expectedCollections);
        expect(window.electronAPI.db.migrateCollection).toHaveBeenCalledTimes(expectedCollections.length);
        expect(deleteDexie).not.toHaveBeenCalled();
        expect(JSON.parse(localStorage.getItem("dexie_sqlite_migration_v2") ?? "null")).toMatchObject({
            status: "verified",
            stores: Object.fromEntries(expectedCollections.map((name) => [name, { status: "complete" }])),
        });
    });

    it("migrates generic records in fixed-size batches and preserves aggregate counts", async () => {
        collectionRecords.set(
            "notes",
            Array.from({ length: 501 }, (_, index) => ({ id: `note-${index}` })),
        );

        await migrateDexieToSqlite();

        const noteCalls = vi
            .mocked(window.electronAPI.db.migrateCollection)
            .mock.calls.filter(([name]) => name === "notes");
        expect(noteCalls.map(([, records]) => records.length)).toEqual([500, 1]);
        expect(JSON.parse(localStorage.getItem("dexie_sqlite_migration_v2") ?? "null")).toMatchObject({
            stores: {
                notes: {
                    counts: { found: 501, imported: 501, updated: 0, identical: 0, skipped: 0 },
                },
            },
        });

        await migrateDexieToSqlite();
        const noteVerificationCalls = vi
            .mocked(window.electronAPI.db.verifyCollection)
            .mock.calls.filter(([name]) => name === "notes");
        expect(noteVerificationCalls.map(([, records]) => records.length)).toEqual([500, 1]);
    });

    it("resumes after a later batch fails without replaying completed batches", async () => {
        collectionRecords.set(
            "notes",
            Array.from({ length: 501 }, (_, index) => ({ id: `note-${index}` })),
        );
        let noteBatch = 0;
        vi.mocked(window.electronAPI.db.migrateCollection).mockImplementation(async (name, records) => {
            if (name === "notes" && ++noteBatch === 2) throw new Error("batch 2 failed");
            return {
                found: records.length,
                imported: records.length,
                updated: 0,
                identical: 0,
                skipped: 0,
            };
        });

        await migrateDexieToSqlite();

        const noteCalls = vi
            .mocked(window.electronAPI.db.migrateCollection)
            .mock.calls.filter(([name]) => name === "notes");
        expect(noteCalls.map(([, records]) => records.length)).toEqual([500, 1, 1]);
        expect(JSON.parse(localStorage.getItem("dexie_sqlite_migration_v2") ?? "null")).toMatchObject({
            stores: {
                notes: {
                    status: "complete",
                    attempts: 2,
                    counts: { found: 501, imported: 501, updated: 0, identical: 0, skipped: 0 },
                },
            },
        });
    });

    it("keeps Dexie data after a failed store and cleans it only on startup after independent verification", async () => {
        vi.mocked(window.electronAPI.db.migrateCollection).mockRejectedValue(new Error("failed"));

        await migrateDexieToSqlite();
        expect(deleteDexie).not.toHaveBeenCalled();
        expect(JSON.parse(localStorage.getItem("dexie_sqlite_migration_v2") ?? "null").status).toBe("running");

        vi.mocked(window.electronAPI.db.migrateCollection).mockResolvedValue({
            found: 0,
            imported: 0,
            updated: 0,
            identical: 0,
            skipped: 0,
        });
        await migrateDexieToSqlite();
        expect(deleteDexie).not.toHaveBeenCalled();
        expect(JSON.parse(localStorage.getItem("dexie_sqlite_migration_v2") ?? "null").status).toBe("verified");

        await migrateDexieToSqlite();
        expect(window.electronAPI.db.verifyCollection).toHaveBeenCalledTimes(expectedCollections.length);
        expect(deleteDexie).toHaveBeenCalledOnce();
        expect(JSON.parse(localStorage.getItem("dexie_sqlite_migration_v2") ?? "null").status).toBe("cleaned");
    });

    it("retains Dexie when independent SQLite verification finds a missing key", async () => {
        await migrateDexieToSqlite();
        collectionRecords.set("notes", [{ id: "missing" }]);
        vi.mocked(window.electronAPI.db.verifyCollection).mockResolvedValueOnce({
            sourceCount: 1,
            destinationCount: 1,
            matched: 0,
        });

        await migrateDexieToSqlite();

        expect(deleteDexie).not.toHaveBeenCalled();
        expect(window.electronAPI.db.migrateCollection).toHaveBeenCalledWith("notes", [{ id: "missing" }]);
    });

    it("deletes the source only on startup after a successful secure credential write", async () => {
        const credential = { adapterId: "openai", apiKey: "secret" };
        credentialsToArray.mockResolvedValue([credential]);

        await migrateDexieToSqlite();

        expect(window.electronAPI.ai.migrateCredentials).toHaveBeenCalledWith(credential);
        expect(deleteDexie).not.toHaveBeenCalled();
        expect(JSON.parse(localStorage.getItem("dexie_sqlite_migration_v2") ?? "null")).toMatchObject({
            status: "verified",
            stores: {
                aiCredentials: {
                    status: "complete",
                    counts: { found: 1, imported: 1, updated: 0, identical: 0, skipped: 0 },
                },
            },
        });

        await migrateDexieToSqlite();
        expect(deleteDexie).toHaveBeenCalledOnce();
        expect(vi.mocked(window.electronAPI.ai.migrateCredentials).mock.invocationCallOrder[0]).toBeLessThan(
            deleteDexie.mock.invocationCallOrder[0]!,
        );
    });

    it("retains credentials when secure storage cannot migrate them", async () => {
        credentialsToArray.mockResolvedValue([{ adapterId: "openai", apiKey: "secret" }]);
        vi.mocked(window.electronAPI.ai.migrateCredentials).mockResolvedValue({
            status: "skipped",
        });

        await migrateDexieToSqlite();
        await migrateDexieToSqlite();

        expect(deleteDexie).not.toHaveBeenCalled();
        expect(JSON.parse(localStorage.getItem("dexie_sqlite_migration_v2") ?? "null").status).toBe(
            "verified-credentials-retained",
        );
    });
});
