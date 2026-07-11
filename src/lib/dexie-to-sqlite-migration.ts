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
type StoreState = {
    status: "complete" | "failed";
    attempts: number;
    counts?: Counts;
    nextOffset?: number;
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

async function migrateStore(
    name: (typeof COLLECTIONS)[number],
    progress: StoreState | undefined,
    saveProgress: (counts: Counts, nextOffset: number) => void,
): Promise<Counts> {
    const records = await db.table(name).toArray();
    const counts: Counts = {
        found: records.length,
        imported: progress?.counts?.imported ?? 0,
        updated: progress?.counts?.updated ?? 0,
        identical: progress?.counts?.identical ?? 0,
        skipped: progress?.counts?.skipped ?? 0,
    };
    const nextOffset = Math.min(progress?.nextOffset ?? 0, records.length);
    saveProgress(counts, nextOffset);

    for (let offset = nextOffset; offset < Math.max(records.length, 1); offset += MIGRATION_BATCH_SIZE) {
        const batchCounts = await window.electronAPI.db.migrateCollection(
            name,
            records.slice(offset, offset + MIGRATION_BATCH_SIZE),
        );
        for (const key of ["imported", "updated", "identical", "skipped"] as const) {
            counts[key] += batchCounts[key];
        }
        saveProgress(counts, Math.min(offset + MIGRATION_BATCH_SIZE, records.length));
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
        const records = await db.table(name).toArray();
        let matched = 0;
        let destinationCount = 0;
        for (let offset = 0; offset < Math.max(records.length, 1); offset += MIGRATION_BATCH_SIZE) {
            const batch = records.slice(offset, offset + MIGRATION_BATCH_SIZE);
            const result = await window.electronAPI.db.verifyCollection(name, batch);
            if (result.sourceCount !== batch.length) break;
            matched += result.matched;
            destinationCount = result.destinationCount;
        }
        if (matched !== records.length || destinationCount < records.length) {
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
                    const counts = await migrateStore(name, state.stores[name], (progressCounts, nextOffset) => {
                        state.stores[name] = {
                            status: "failed",
                            attempts,
                            counts: { ...progressCounts },
                            nextOffset,
                        };
                        writeState(state);
                    });
                    state.stores[name] = {
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
