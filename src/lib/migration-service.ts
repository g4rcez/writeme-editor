import { repositories } from "../store/global.store";
import { SettingsRepository } from "../store/settings";
import { generateNotePath, getUniqueFilePath } from "./file-utils";

/**
 * Service for migrating notes from IndexedDB-only storage to hybrid file-based storage
 */
export class MigrationService {
  /**
   * Check if any notes need migration
   * @returns True if there are notes without a filePath
   */
  static async needsMigration(): Promise<boolean> {
    const notes = await repositories.notes.getAll();
    return notes.some((note: any) => !note.filePath);
  }

  /**
   * Count how many notes need migration
   * @returns Number of notes without filePath
   */
  static async getMigrationCount(): Promise<number> {
    const notes = await repositories.notes.getAll();
    return notes.filter((note: any) => !note.filePath).length;
  }

  /**
   * Migrate all notes from IndexedDB-only to file-based storage
   * @param onProgress Optional callback for progress updates
   * @returns Summary of migration results
   */
  static async migrateAllNotes(
    onProgress?: (current: number, total: number) => void,
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const settings = SettingsRepository.load();

    if (!settings.directory) {
      throw new Error(
        "Storage directory not configured. Cannot migrate notes.",
      );
    }

    const notes = await repositories.notes.getAll();
    const notesToMigrate = notes.filter((note: any) => !note.filePath);

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < notesToMigrate.length; i++) {
      const note: any = notesToMigrate[i];

      try {
        await this.migrateNote(note, settings.directory);
        success++;

        if (onProgress) {
          onProgress(i + 1, notesToMigrate.length);
        }
      } catch (error: any) {
        failed++;
        errors.push(`Note "${note.title}": ${error.message}`);
      }
    }

    return { success, failed, errors };
  }

  /**
   * Migrate a single note to file-based storage
   * @param note Note object from IndexedDB
   * @param directory Root directory for file storage
   */
  static async migrateNote(note: any, directory: string): Promise<void> {
    // Generate file path
    const filePath = generateNotePath(
      directory,
      note.title,
    );

    // Get unique path (handle duplicates)
    const uniquePath = await getUniqueFilePath(filePath, async (path) => {
      const result = await window.electronAPI.fs.statFile(path);
      return result.exists;
    });

    // Write content to file
    const writeResult = await window.electronAPI.fs.writeFile(
      uniquePath,
      note.content || "",
    );

    if (!writeResult.success) {
      throw new Error(`Failed to write file: ${writeResult.error}`);
    }

    // Update note in IndexedDB with file metadata
    const updatedNote = {
      ...note,
      filePath: uniquePath,
      fileSize: writeResult.fileSize,
      lastSynced: new Date(writeResult.lastModified),
      content: undefined
    };
    // @ts-ignore
    await repositories.notes.update(note.id, updatedNote);
  }
}
