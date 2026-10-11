import { exportDB, importInto, peakImportFile } from "dexie-export-import";
import { db } from "@/store/repositories/browser/dexie-db";

const BACKUP_TABLES = new Set([
    "notes",
    "pdfAssets",
    "comments",
    "noteHistory",
    "hashtags",
    "scripts",
    "noteGroups",
    "noteGroupMembers",
    "views",
]);

export async function createMobileBackup(): Promise<Blob> {
    return exportDB(db, { filter: (table: string) => BACKUP_TABLES.has(table) });
}

export async function restoreMobileBackup(file: Blob): Promise<void> {
    const metadata = await peakImportFile(file);
    if (metadata.data.databaseName !== db.name || metadata.data.databaseVersion !== db.verno) {
        throw new Error("Choose a backup exported by this version of Writeme.");
    }
    await importInto(db, file, {
        overwriteValues: false,
        filter: (table: string) => BACKUP_TABLES.has(table),
    });
}
