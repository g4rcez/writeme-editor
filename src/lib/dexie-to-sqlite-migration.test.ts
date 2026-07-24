import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    collectionRecords,
    deleteDexie,
    table,
    credentialsToArray,
    sourceReadLimits,
    sourceOffset,
    sourceOrderByCalls,
    sourceWhereAboveCalls,
    unboundedSourceToArray,
} = vi.hoisted(() => {
    const records = new Map<string, unknown[]>();
    const readLimits: number[] = [];
    const orderByCalls: Array<[string, string]> = [];
    const whereAboveCalls: Array<[string, string, string | number]> = [];
    const primaryKeyFor = (name: string): string => (name === "cursorPositions" ? "noteId" : "id");
    const keyFor = (record: unknown, primaryKey: string): unknown =>
        record && typeof record === "object" && !Array.isArray(record)
            ? (record as Record<string, unknown>)[primaryKey]
            : undefined;
    const compareKeys = (left: unknown, right: unknown): number => {
        if (left === right) return 0;
        return (left as string | number) < (right as string | number) ? -1 : 1;
    };
    const clone = (record: unknown): unknown =>
        record && typeof record === "object" && !Array.isArray(record) ? { ...record } : record;
    const page = (name: string, primaryKey: string, lastKey?: string | number) => ({
        limit: (limit: number) => {
            readLimits.push(limit);
            return {
                toArray: () => {
                    const ordered = [...(records.get(name) ?? [])].sort((left, right) =>
                        compareKeys(keyFor(left, primaryKey), keyFor(right, primaryKey)),
                    );
                    const remaining =
                        lastKey === undefined
                            ? ordered
                            : ordered.filter((record) => compareKeys(keyFor(record, primaryKey), lastKey) > 0);
                    return Promise.resolve(remaining.slice(0, limit).map(clone));
                },
            };
        },
    });
    const offset = vi.fn(() => {
        throw new Error("Offset source read");
    });
    const unboundedToArray = vi.fn(() => {
        throw new Error("Unbounded source read");
    });
    return {
        collectionRecords: records,
        deleteDexie: vi.fn(),
        table: vi.fn((name: string) => {
            const primaryKey = primaryKeyFor(name);
            return {
                schema: { primKey: { name: primaryKey } },
                count: () => Promise.resolve(records.get(name)?.length ?? 0),
                orderBy: (index: string) => {
                    if (index !== primaryKey) throw new Error(`Unknown index: ${index}`);
                    orderByCalls.push([name, index]);
                    return page(name, primaryKey);
                },
                where: (index: string) => ({
                    above: (lastKey: string | number) => {
                        if (index !== primaryKey) throw new Error(`Unknown index: ${index}`);
                        whereAboveCalls.push([name, index, lastKey]);
                        return page(name, primaryKey, lastKey);
                    },
                }),
                offset,
                toArray: unboundedToArray,
            };
        }),
        credentialsToArray: vi.fn<() => Promise<unknown[]>>(() => Promise.resolve([])),
        sourceReadLimits: readLimits,
        sourceOffset: offset,
        sourceOrderByCalls: orderByCalls,
        sourceWhereAboveCalls: whereAboveCalls,
        unboundedSourceToArray: unboundedToArray,
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
    sourceReadLimits.length = 0;
    sourceOrderByCalls.length = 0;
    sourceWhereAboveCalls.length = 0;
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
                verifyCollection: vi.fn(async (name: string, records: unknown[]) => ({
                    sourceCount: records.length,
                    destinationCount: collectionRecords.get(name)?.length ?? 0,
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
        for (const name of expectedCollections) {
            const primaryKey = name === "cursorPositions" ? "noteId" : "id";
            collectionRecords.set(name, [{ [primaryKey]: `${name}-id` }]);
        }

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

    it("bounds every generic source read during migration and verification", async () => {
        collectionRecords.set(
            "notes",
            Array.from({ length: 1_001 }, (_, index) => ({ id: `note-${index}` })),
        );

        await migrateDexieToSqlite();
        await migrateDexieToSqlite();

        expect(sourceReadLimits.length).toBeGreaterThan(0);
        expect(sourceReadLimits.every((limit) => limit <= 500)).toBe(true);
        expect(sourceOffset).not.toHaveBeenCalled();
        expect(unboundedSourceToArray).not.toHaveBeenCalled();
        expect(sourceOrderByCalls.filter(([name]) => name === "notes")).toEqual([
            ["notes", "id"],
            ["notes", "id"],
        ]);
        expect(sourceWhereAboveCalls.filter(([name]) => name === "notes")).toHaveLength(4);
        expect(sourceWhereAboveCalls.every(([, index]) => index === "id")).toBe(true);
    });

    it("retains a malformed source record when SQLite validation rejects its non-string ID", async () => {
        const malformed = { id: 42, title: "Malformed note" };
        collectionRecords.set("notes", [malformed]);
        vi.mocked(window.electronAPI.db.migrateCollection).mockImplementation(async (name, records) => {
            if (name === "notes" && typeof (records[0] as { id?: unknown } | undefined)?.id !== "string") {
                throw new TypeError("Invalid notes record");
            }
            return {
                found: records.length,
                imported: records.length,
                updated: 0,
                identical: 0,
                skipped: 0,
            };
        });

        await migrateDexieToSqlite();

        expect(collectionRecords.get("notes")).toEqual([malformed]);
        expect(deleteDexie).not.toHaveBeenCalled();
        expect(JSON.parse(localStorage.getItem("dexie_sqlite_migration_v2") ?? "null")).toMatchObject({
            status: "running",
            stores: { notes: { status: "failed", attempts: 2, error: "Invalid notes record" } },
        });
    });

    it("resumes after a later batch fails without replaying completed batches", async () => {
        collectionRecords.set(
            "notes",
            Array.from({ length: 501 }, (_, index) => ({ id: `note-${index.toString().padStart(4, "0")}` })),
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
        expect(noteCalls.map(([, records]) => (records[0] as { id: string }).id)).toEqual([
            "note-0000",
            "note-0500",
            "note-0500",
        ]);
        expect(sourceWhereAboveCalls.filter(([name]) => name === "notes")).toEqual([
            ["notes", "id", "note-0499"],
            ["notes", "id", "note-0499"],
        ]);
        expect(JSON.parse(localStorage.getItem("dexie_sqlite_migration_v2") ?? "null")).toMatchObject({
            stores: {
                notes: {
                    status: "complete",
                    attempts: 2,
                    nextOffset: 501,
                    lastKey: "note-0500",
                    counts: { found: 501, imported: 501, updated: 0, identical: 0, skipped: 0 },
                },
            },
        });
    });

    it("restarts a legacy offset checkpoint without replaying its aggregate counts", async () => {
        collectionRecords.set(
            "notes",
            Array.from({ length: 501 }, (_, index) => ({ id: `note-${index.toString().padStart(4, "0")}` })),
        );
        collectionRecords.set("projects", [{ id: "project-existing" }]);
        const completedProject = {
            status: "complete",
            attempts: 1,
            nextOffset: 1,
            counts: { found: 1, imported: 1, updated: 0, identical: 0, skipped: 0 },
        };
        localStorage.setItem(
            "dexie_sqlite_migration_v2",
            JSON.stringify({
                status: "running",
                stores: {
                    notes: {
                        status: "failed",
                        attempts: 1,
                        nextOffset: 500,
                        counts: { found: 501, imported: 500, updated: 0, identical: 0, skipped: 0 },
                    },
                    projects: completedProject,
                },
            }),
        );

        await migrateDexieToSqlite();

        const noteCalls = vi
            .mocked(window.electronAPI.db.migrateCollection)
            .mock.calls.filter(([name]) => name === "notes");
        expect(noteCalls.map(([, records]) => records.length)).toEqual([500, 1]);
        expect(noteCalls[0]?.[1][0]).toEqual({ id: "note-0000" });
        expect(window.electronAPI.db.migrateCollection).not.toHaveBeenCalledWith("projects", expect.anything());
        const state = JSON.parse(localStorage.getItem("dexie_sqlite_migration_v2") ?? "null");
        expect(state.stores.notes).toMatchObject({
            status: "complete",
            nextOffset: 501,
            lastKey: "note-0500",
            counts: { found: 501, imported: 501, updated: 0, identical: 0, skipped: 0 },
        });
        expect(state.stores.projects).toEqual(completedProject);
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
