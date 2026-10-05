import { TERMINAL_TAB_TYPE } from "@/lib/tab-target";
import { db } from "@/store/repositories/browser/dexie-db";
import { z } from "zod";

const WWW_ORIGIN = "https://www.writeme.dev";
const APP_ORIGIN = "https://app.writeme.dev";
const MIGRATION_TIMEOUT_MS = 120_000;

export type MigrationCounts = {
    notes: number;
    tabs: number;
    hashtags: number;
    settings: number;
    scripts: number;
    noteHistory: number;
};

const ValidDateSchema = z.union([
    z.date(),
    z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
]);
const NullableDateSchema = ValidDateSchema.nullable();
const MigrationRecordSchema = z.object({ id: z.string().min(1) }).catchall(z.unknown());
const NoteRecordSchema = MigrationRecordSchema.extend({
    type: z.string().optional(),
    title: z.string(),
    content: z.string(),
    project: z.string().optional(),
    createdAt: ValidDateSchema.optional(),
    updatedAt: ValidDateSchema.optional(),
    filePath: z.string().nullable().optional(),
    fileSize: z.number().finite().optional(),
    lastSynced: NullableDateSchema.optional(),
    tags: z.array(z.string()).optional(),
    createdBy: z.string().optional(),
    updatedBy: z.string().optional(),
    noteType: z.string().optional(),
    url: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    favicon: z.string().nullable().optional(),
    metadata: z.object({}).catchall(z.unknown()).optional(),
    favorite: z.boolean().optional(),
    deletedAt: NullableDateSchema.optional(),
});
const TabRecordSchema = MigrationRecordSchema.extend({
    noteId: z.string().min(1),
    order: z.number().finite(),
    type: z.string().optional(),
    project: z.string().optional(),
    createdAt: ValidDateSchema.optional(),
    updatedAt: ValidDateSchema.optional(),
    scrollY: z.number().finite().optional(),
});
const HashtagRecordSchema = MigrationRecordSchema.extend({
    type: z.string().optional(),
    hashtag: z.string(),
    filename: z.string(),
    project: z.string().optional(),
    createdAt: ValidDateSchema.optional(),
    updatedAt: ValidDateSchema.optional(),
});
const SettingRecordSchema = MigrationRecordSchema.extend({
    name: z.string(),
    value: z.string(),
    type: z.string().optional(),
    createdAt: ValidDateSchema.optional(),
    updatedAt: ValidDateSchema.optional(),
});
const ScriptRecordSchema = MigrationRecordSchema.extend({
    type: z.string().optional(),
    name: z.string(),
    content: z.string(),
    createdAt: ValidDateSchema.optional(),
    updatedAt: ValidDateSchema.optional(),
});
const NoteHistoryRecordSchema = MigrationRecordSchema.extend({
    noteId: z.string().min(1),
    content: z.string(),
    createdAt: ValidDateSchema,
});
const MigrationPayloadSchema = z.discriminatedUnion("version", [
    z.object({
        type: z.literal("writeme-migration"),
        version: z.literal(1),
        notes: z.array(NoteRecordSchema),
        tabs: z.array(TabRecordSchema),
        hashtags: z.array(HashtagRecordSchema),
        settings: z.array(SettingRecordSchema),
        scripts: z.array(ScriptRecordSchema),
        noteHistory: z.array(NoteHistoryRecordSchema).optional(),
    }),
    z.object({
        type: z.literal("writeme-migration"),
        version: z.literal(2),
        notes: z.array(NoteRecordSchema),
        tabs: z.array(TabRecordSchema),
        hashtags: z.array(HashtagRecordSchema),
        settings: z.array(SettingRecordSchema),
        scripts: z.array(ScriptRecordSchema),
        noteHistory: z.array(NoteHistoryRecordSchema),
    }),
]);
const MigrationAcknowledgementSchema = z.object({
    type: z.literal("writeme-migration-ack"),
    status: z.enum(["success", "error"]),
    error: z.string().optional(),
});

type MigrationRecord = z.infer<typeof MigrationRecordSchema>;
type MigrationPayload = {
    type: "writeme-migration";
    version: 2;
    notes: MigrationRecord[];
    tabs: MigrationRecord[];
    hashtags: MigrationRecord[];
    settings: MigrationRecord[];
    scripts: MigrationRecord[];
    noteHistory: MigrationRecord[];
};
type MigrationTable = {
    get(id: string): Promise<unknown>;
    add(value: never): Promise<unknown>;
};
type PendingWrite = () => Promise<unknown>;

const DATE_FIELDS = new Set(["createdAt", "updatedAt", "deletedAt", "lastSynced"]);

function recordsForCollection(collection: string, values: MigrationRecord[]): MigrationRecord[] {
    const records: MigrationRecord[] = [];
    const seen = new Map<string, MigrationRecord>();
    for (const record of values) {
        const duplicate = seen.get(record.id);
        if (duplicate) {
            if (!areEqual(duplicate, record)) {
                throw new Error(`Invalid migration file: duplicate IDs in "${collection}" contain different data.`);
            }
            continue;
        }
        seen.set(record.id, record);
        records.push(record);
    }
    return records;
}

function areEqual(left: unknown, right: unknown): boolean {
    if (left === right) return true;
    if (left instanceof Date || right instanceof Date) {
        return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
    }
    if (Array.isArray(left) || Array.isArray(right)) {
        return (
            Array.isArray(left) &&
            Array.isArray(right) &&
            left.length === right.length &&
            left.every((value, index) => areEqual(value, right[index]))
        );
    }
    if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    return (
        leftKeys.length === rightKeys.length &&
        leftKeys.every((key) => Object.hasOwn(rightRecord, key) && areEqual(leftRecord[key], rightRecord[key]))
    );
}

function parseMigrationPayload(value: unknown): MigrationPayload {
    const parsed = MigrationPayloadSchema.safeParse(value);
    if (!parsed.success) throw new Error("Invalid backup file format.");
    const payload = parsed.data;
    return {
        type: "writeme-migration",
        version: 2,
        notes: recordsForCollection("notes", payload.notes),
        tabs: recordsForCollection("tabs", payload.tabs).filter((tab) => tab.type !== TERMINAL_TAB_TYPE),
        hashtags: recordsForCollection("hashtags", payload.hashtags),
        settings: recordsForCollection("settings", payload.settings),
        scripts: recordsForCollection("scripts", payload.scripts),
        noteHistory: recordsForCollection("noteHistory", payload.noteHistory ?? []),
    };
}

async function collectNewRows(
    table: MigrationTable,
    collection: string,
    rows: MigrationRecord[],
    pendingWrites: PendingWrite[],
): Promise<void> {
    for (const row of rows) {
        const existing = await table.get(row.id);
        if (existing !== undefined) {
            if (areEqual(existing, row)) continue;
            throw new Error(
                `Migration stopped: "${collection}" record "${row.id}" already exists with different data. Nothing was changed; the source data is still available.`,
            );
        }
        pendingWrites.push(() => table.add(row as never));
    }
}

async function importAllData(value: unknown): Promise<MigrationCounts> {
    const payload = parseMigrationPayload(value);
    await db.transaction(
        "rw",
        [db.notes, db.tabs, db.hashtags, db.settings, db.scripts, db.noteHistory],
        async () => {
            const pendingWrites: PendingWrite[] = [];
            await collectNewRows(db.notes, "notes", payload.notes, pendingWrites);
            await collectNewRows(db.tabs, "tabs", payload.tabs, pendingWrites);
            await collectNewRows(db.hashtags, "hashtags", payload.hashtags, pendingWrites);
            await collectNewRows(db.settings, "settings", payload.settings, pendingWrites);
            await collectNewRows(db.scripts, "scripts", payload.scripts, pendingWrites);
            await collectNewRows(db.noteHistory, "noteHistory", payload.noteHistory, pendingWrites);
            for (const write of pendingWrites) await write();
        },
    );

    return {
        notes: payload.notes.length,
        tabs: payload.tabs.length,
        hashtags: payload.hashtags.length,
        settings: payload.settings.length,
        scripts: payload.scripts.length,
        noteHistory: payload.noteHistory.length,
    };
}

async function readMigrationPayload(): Promise<MigrationPayload> {
    const [notes, tabs, hashtags, settings, scripts, noteHistory] = await Promise.all([
        db.notes.toArray(),
        db.tabs.toArray(),
        db.hashtags.toArray(),
        db.settings.toArray(),
        db.scripts.toArray(),
        db.noteHistory.toArray(),
    ]);

    return {
        type: "writeme-migration",
        version: 2,
        notes: notes as unknown as MigrationRecord[],
        tabs: tabs.filter((tab) => tab.type !== TERMINAL_TAB_TYPE) as unknown as MigrationRecord[],
        hashtags: hashtags as unknown as MigrationRecord[],
        settings: settings as unknown as MigrationRecord[],
        scripts: scripts as unknown as MigrationRecord[],
        noteHistory: noteHistory as unknown as MigrationRecord[],
    };
}

export function startMigration(): Promise<MigrationCounts> {
    const { promise, resolve, reject } = Promise.withResolvers<MigrationCounts>();
    const popup = window.open(`${WWW_ORIGIN}/#/migrate`, "_blank", "width=480,height=320");
    if (!popup) {
        reject(new Error("Popup was blocked. Please allow popups for this site."));
        return promise;
    }

    let processing = false;
    let timeoutId: number;
    const cleanup = () => {
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", onMessage);
    };
    const acknowledge = (status: "success" | "error", error?: string) => {
        popup.postMessage({ type: "writeme-migration-ack", status, error }, WWW_ORIGIN);
    };
    const onMessage = (event: MessageEvent<unknown>) => {
        if (event.origin !== WWW_ORIGIN || event.source !== popup || processing) return;
        processing = true;

        void importAllData(event.data).then(
            (counts) => {
                try {
                    acknowledge("success");
                    cleanup();
                    resolve(counts);
                } catch (error) {
                    cleanup();
                    reject(error);
                }
            },
            (error: unknown) => {
                const message = error instanceof Error ? error.message : "The migration could not be completed.";
                try {
                    acknowledge("error", message);
                } catch {
                    // Keep the import failure as the primary error.
                }
                cleanup();
                reject(error);
            },
        );
    };
    timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error("Migration timed out. The source data remains in its original browser storage."));
    }, MIGRATION_TIMEOUT_MS);
    window.addEventListener("message", onMessage);
    return promise;
}

export async function exportToFile(): Promise<void> {
    const payload = await readMigrationPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `writeme-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export async function importFromFile(file: File): Promise<MigrationCounts> {
    const text = await file.text();
    const data = JSON.parse(text, (key: string, value: unknown) => {
        if (!DATE_FIELDS.has(key) || typeof value !== "string") return value;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : date;
    }) as unknown;
    return importAllData(data);
}

export async function sendMigrationData(): Promise<void> {
    const opener = window.opener;
    if (!opener) throw new Error("This page must be opened from the Writeme migration button.");
    const payload = await readMigrationPayload();
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    let timeoutId: number;
    const cleanup = () => {
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", onAcknowledgement);
    };
    const onAcknowledgement = (event: MessageEvent<unknown>) => {
        if (event.origin !== APP_ORIGIN || event.source !== opener) return;
        const parsed = MigrationAcknowledgementSchema.safeParse(event.data);
        if (!parsed.success) return;
        cleanup();
        if (parsed.data.status === "success") {
            resolve();
            return;
        }
        reject(
            new Error(
                parsed.data.error ??
                "The destination could not confirm the migration. Your source data remains available.",
            ),
        );
    };
    timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error("The destination did not confirm the migration. Your source data remains available."));
    }, MIGRATION_TIMEOUT_MS);

    window.addEventListener("message", onAcknowledgement);
    try {
        opener.postMessage(payload, APP_ORIGIN);
    } catch (error) {
        cleanup();
        reject(error);
    }
    return promise;
}
