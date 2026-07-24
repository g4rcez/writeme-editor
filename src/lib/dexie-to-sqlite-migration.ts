import { db } from "../store/repositories/browser/dexie-db";
import { isElectron } from "./is-electron";

const MIGRATION_KEY = "dexie_sqlite_migration_v2";
const MIGRATION_BATCH_SIZE = 500;
const ISSUE_URL = "https://github.com/g4rcez/writeme-editor/issues/new";
const COLLECTIONS = [
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
] as const;

type Counts = {
    found: number;
    imported: number;
    updated: number;
    identical: number;
    skipped: number;
};
type CheckpointKey = string | number;
type StoreState = {
    status: "complete" | "failed";
    attempts: number;
    counts?: Counts;
    nextOffset?: number;
    lastKey?: CheckpointKey;
    error?: string;
};
type MigrationState = {
    status: "running" | "verified" | "verified-credentials-retained" | "cleaned";
    verifiedAt?: string;
    stores: Record<string, StoreState>;
};

function readState(): MigrationState {
    try {
        const value = JSON.parse(localStorage.getItem(MIGRATION_KEY) ?? "null") as MigrationState | null;
        if (value?.stores) return value;
    } catch {
        // A corrupt marker is safe to rebuild because imports are conflict-aware.
    }
    return { status: "running", stores: {} };
}

function writeState(state: MigrationState): void {
    localStorage.setItem(MIGRATION_KEY, JSON.stringify(state));
}

export function migrationIssueUrl(state: MigrationState): string {
    const failed = Object.entries(state.stores)
        .filter(([, value]) => value.status === "failed")
        .map(([name, value]) => `${name}: attempts=${value.attempts}, found=${value.counts?.found ?? "unknown"}`);
    const params = new URLSearchParams({
        title: "Dexie to SQLite migration failed",
        body: `Migration summary (no record values included):\n${failed.join("\n")}`,
    });
    return `${ISSUE_URL}?${params}`;
}

function isCheckpointKey(value: unknown): value is CheckpointKey {
    return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}

function recordPrimaryKey(record: unknown, primaryKey: string): CheckpointKey {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
        throw new TypeError(`Invalid ${primaryKey} primary key`);
    }
    const value = (record as Record<string, unknown>)[primaryKey];
    if (!isCheckpointKey(value)) throw new TypeError(`Invalid ${primaryKey} primary key`);
    return value;
}

async function migrateStore(
    name: (typeof COLLECTIONS)[number],
    progress: StoreState | undefined,
    saveProgress: (counts: Counts, nextOffset: number, lastKey?: CheckpointKey) => void,
): Promise<Counts> {
    const table = db.table(name);
    const total = await table.count();
    const hasCheckpoint = isCheckpointKey(progress?.lastKey);
    const restartLegacyProgress = (progress?.nextOffset ?? 0) > 0 && !hasCheckpoint;
    const counts: Counts = {
        found: total,
        imported: restartLegacyProgress ? 0 : (progress?.counts?.imported ?? 0),
        updated: restartLegacyProgress ? 0 : (progress?.counts?.updated ?? 0),
        identical: restartLegacyProgress ? 0 : (progress?.counts?.identical ?? 0),
        skipped: restartLegacyProgress ? 0 : (progress?.counts?.skipped ?? 0),
    };
    let processed = restartLegacyProgress ? 0 : Math.min(progress?.nextOffset ?? 0, total);
    let lastKey = hasCheckpoint ? progress.lastKey : undefined;
    const primaryKey = table.schema.primKey.name;

    while (processed < Math.max(total, 1)) {
        const batch = await (lastKey === undefined ? table.orderBy(primaryKey) : table.where(primaryKey).above(lastKey))
            .limit(MIGRATION_BATCH_SIZE)
            .toArray();
        const nextLastKey = batch.length ? recordPrimaryKey(batch.at(-1), primaryKey) : undefined;
        const batchCounts = await window.electronAPI.db.migrateCollection(name, batch);
        for (const key of ["imported", "updated", "identical", "skipped"] as const) {
            counts[key] += batchCounts[key];
        }
        processed = Math.min(processed + batch.length, total);
        if (nextLastKey !== undefined) lastKey = nextLastKey;
        saveProgress(counts, processed, lastKey);
        if (!batch.length) break;
    }
    return counts;
}

async function migrateCredentials(): Promise<StoreState> {
    const records = await db.aiCredentials.toArray();
    const counts: Counts = {
        found: records.length,
        imported: 0,
        updated: 0,
        identical: 0,
        skipped: 0,
    };
    for (const record of records) {
        const result = await window.electronAPI.ai.migrateCredentials(record);
        counts[result.status]++;
    }
    return {
        status: counts.skipped ? "failed" : "complete",
        attempts: 1,
        counts,
        ...(counts.skipped
            ? {
                  error: "Secure credential storage is unavailable or SQLite has an equal/newer record",
              }
            : {}),
    };
}

async function removeVerifiedDexie(state: MigrationState): Promise<boolean> {
    if (state.status !== "verified" || !state.verifiedAt) return false;

    for (const name of COLLECTIONS) {
        const table = db.table(name);
        const total = await table.count();
        let matched = 0;
        let destinationCount = 0;
        const primaryKey = table.schema.primKey.name;
        let processed = 0;
        let lastKey: CheckpointKey | undefined;
        while (processed < Math.max(total, 1)) {
            const batch = await (
                lastKey === undefined ? table.orderBy(primaryKey) : table.where(primaryKey).above(lastKey)
            )
                .limit(MIGRATION_BATCH_SIZE)
                .toArray();
            const nextLastKey = batch.length ? recordPrimaryKey(batch.at(-1), primaryKey) : undefined;
            const result = await window.electronAPI.db.verifyCollection(name, batch);
            if (result.sourceCount !== batch.length) break;
            matched += result.matched;
            destinationCount = result.destinationCount;
            processed += batch.length;
            if (nextLastKey !== undefined) lastKey = nextLastKey;
            if (!batch.length) break;
        }
        if (matched !== total || destinationCount < total) {
            state.status = "running";
            state.stores[name] = {
                status: "failed",
                attempts: state.stores[name]?.attempts ?? 0,
                error: "Independent SQLite verification failed",
            };
            writeState(state);
            return false;
        }
    }

    await db.delete();
    writeState({ ...state, status: "cleaned" });
    return true;
}

export async function migrateDexieToSqlite(): Promise<void> {
    if (!isElectron()) return;

    const state = readState();
    try {
        if (await removeVerifiedDexie(state)) return;

        state.status = "running";
        for (const name of COLLECTIONS) {
            if (state.stores[name]?.status === "complete") continue;
            let lastError: unknown;
            const previousAttempts = state.stores[name]?.attempts ?? 0;
            for (let attempt = 1; attempt <= 2; attempt++) {
                const attempts = previousAttempts + attempt;
                try {
                    const counts = await migrateStore(
                        name,
                        state.stores[name],
                        (progressCounts, nextOffset, lastKey) => {
                            state.stores[name] = {
                                status: "failed",
                                attempts,
                                counts: { ...progressCounts },
                                nextOffset,
                                ...(lastKey === undefined ? {} : { lastKey }),
                            };
                            writeState(state);
                        },
                    );
                    state.stores[name] = {
                        ...state.stores[name],
                        status: "complete",
                        attempts,
                        counts,
                    };
                    lastError = undefined;
                    break;
                } catch (error) {
                    lastError = error;
                    state.stores[name] = {
                        ...state.stores[name],
                        status: "failed",
                        attempts,
                        error: error instanceof Error ? error.message : "Unknown migration error",
                    };
                    writeState(state);
                }
            }
            if (lastError) {
                console.error(`Dexie migration failed for ${name}:`, lastError);
            }
            writeState(state);
        }

        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                state.stores.aiCredentials = {
                    ...(await migrateCredentials()),
                    attempts: attempt,
                };
                if (state.stores.aiCredentials.status === "complete") break;
            } catch (error) {
                state.stores.aiCredentials = {
                    status: "failed",
                    attempts: attempt,
                    error: error instanceof Error ? error.message : "Unknown credential migration error",
                };
            }
            writeState(state);
        }

        const genericComplete = COLLECTIONS.every((name) => state.stores[name]?.status === "complete");
        const credentialsComplete = state.stores.aiCredentials?.status === "complete";
        if (genericComplete) {
            state.status = credentialsComplete ? "verified" : "verified-credentials-retained";
            if (credentialsComplete) state.verifiedAt = new Date().toISOString();
        }
        writeState(state);

        const failures = Object.values(state.stores).some((store) => store.status === "failed");
        if (
            failures &&
            window.confirm("Some local data could not be migrated. Open a GitHub issue with private values excluded?")
        ) {
            window.open(migrationIssueUrl(state), "_blank", "noopener,noreferrer");
        }
    } catch (error) {
        console.error("Dexie to SQLite migration failed; continuing normal startup:", error);
    }
}
