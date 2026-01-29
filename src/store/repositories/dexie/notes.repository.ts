import { Note } from "../../note";
import { EntityBase, Repository } from "../../repository";
import { db } from "./dexie-db";
import { SettingsRepository } from "../../settings";
import {
  generateNotePath,
  getUniqueFilePath,
} from "../../../lib/file-utils";

/**
 * Hybrid storage repository for notes
 * - Content stored as .md files on file system
 * - Metadata stored in IndexedDB for fast queries
 */
export class NotesRepository implements Repository<Note> {
  async count(): Promise<number> {
    return await db.notes.count();
  }

  /**
   * Save new note: create file + save metadata to IndexedDB
   */
  async save(item: Note): Promise<Note> {
    const settings = SettingsRepository.load();

    if (!settings.storageDirectory) {
      throw new Error(
        "Storage directory not configured. Please complete workspace setup.",
      );
    }

    // Generate file path
    const filePath = generateNotePath(
      settings.storageDirectory,
      item.project,
      item.title,
    );

    // Check for duplicates and get unique path
    const uniquePath = await getUniqueFilePath(filePath, async (path) => {
      const result = await window.electronAPI.fs.statFile(path);
      return result.exists;
    });

    // Write content to file
    const writeResult = await window.electronAPI.fs.writeFile(
      uniquePath,
      item.content,
    );

    if (!writeResult.success) {
      throw new Error(`Failed to write file: ${writeResult.error}`);
    }

    // Update note metadata
    item.filePath = uniquePath;
    item.fileSize = writeResult.fileSize;
    item.lastSynced = new Date(writeResult.lastModified);
    item.createdBy = settings.defaultAuthor;
    item.updatedBy = settings.defaultAuthor;

    // Save metadata (WITHOUT content) to IndexedDB
    const { content, ...metadata } = item as any;
    await db.notes.add(metadata, item.id);

    return item;
  }

  /**
   * Update existing note: update file + update metadata
   * Handles lazy migration for old notes without filePath
   */
  async update(id: EntityBase["id"], item: Note): Promise<Note> {
    const settings = SettingsRepository.load();

    if (!settings.storageDirectory) {
      throw new Error(
        "Storage directory not configured. Please complete workspace setup.",
      );
    }

    // Get existing note to check for changes
    const existing = await db.notes.get(id);

    if (!existing) {
      throw new Error(`Note ${id} not found`);
    }

    let filePath = existing.filePath;

    // LAZY MIGRATION: Old notes without filePath get migrated on first update
    if (!filePath && (existing as any).content) {
      console.log("Lazy migration for note:", item.title);

      filePath = generateNotePath(
        settings.storageDirectory,
        item.project,
        item.title,
      );

      const uniquePath = await getUniqueFilePath(filePath, async (path) => {
        const result = await window.electronAPI.fs.statFile(path);
        return result.exists;
      });

      // Write old content to file
      const writeResult = await window.electronAPI.fs.writeFile(
        uniquePath,
        (existing as any).content || item.content,
      );

      if (writeResult.success) {
        filePath = uniquePath;
        item.filePath = filePath;
        item.lastSynced = new Date(writeResult.lastModified);
      }
    }

    // Handle title change = file rename
    if (existing.title !== item.title && filePath) {
      const newPath = generateNotePath(
        settings.storageDirectory,
        item.project,
        item.title,
      );

      // Only rename if path actually changed
      if (newPath !== filePath) {
        const moveResult = await window.electronAPI.fs.moveFile(
          filePath,
          newPath,
        );

        if (moveResult.success) {
          filePath = moveResult.newPath;
        } else {
          console.warn(
            `Failed to rename file from ${filePath} to ${newPath}:`,
            moveResult.error,
          );
        }
      }
    }

    // Write updated content to file
    if (filePath) {
      const writeResult = await window.electronAPI.fs.writeFile(
        filePath,
        item.content,
      );

      if (!writeResult.success) {
        throw new Error(`Failed to update file: ${writeResult.error}`);
      }

      item.fileSize = writeResult.fileSize;
      item.lastSynced = new Date(writeResult.lastModified);
    }

    item.filePath = filePath;
    item.updatedBy = settings.defaultAuthor;
    item.updatedAt = new Date();

    // Update metadata in IndexedDB (WITHOUT content)
    const { content, ...metadata } = item as any;
    await db.notes.put(metadata, id);

    return item;
  }

  /**
   * Get single note: read metadata from IndexedDB + content from file
   */
  async getOne(id: EntityBase["id"]): Promise<Note | null> {
    const metadata: any = await db.notes.get(id);

    if (!metadata) {
      return null;
    }

    let content = "";

    if (metadata.filePath) {
      const readResult = await window.electronAPI.fs.readFile(
        metadata.filePath,
      );

      if (readResult.success) {
        content = readResult.content;

        // Check if file was modified externally
        const fileModified = new Date(readResult.lastModified);
        if (metadata.lastSynced && fileModified > metadata.lastSynced) {
          // File changed externally - update sync timestamp
          metadata.lastSynced = fileModified;
          metadata.fileSize = readResult.fileSize;
          await db.notes.update(id, {
            lastSynced: metadata.lastSynced,
            fileSize: metadata.fileSize,
          });
        }
      } else {
        console.warn(`File not found for note ${id}: ${metadata.filePath}`);
        console.warn("Error:", readResult.error);
      }
    } else if (metadata.content) {
      // Fallback for notes not yet migrated
      content = metadata.content;
    }

    return Note.parse({ ...metadata, content });
  }

  /**
   * Get all notes: metadata from IndexedDB (without loading content)
   * Content is loaded lazily when note is opened via getOne()
   */
  async getAll(): Promise<Note[]> {
    const metadataList = await db.notes.toArray();

    // Return notes with empty content - will be loaded on-demand
    return metadataList
      .map((metadata) => Note.parse({ ...metadata, content: "" }))
      .toSorted((a, b) => +b.updatedAt - +a.updatedAt);
  }

  /**
   * Get recent notes sorted by modification date
   */
  async getRecentNotes(limit?: number): Promise<Note[]> {
    let collection = db.notes.orderBy("updatedAt").reverse();

    if (limit) {
      collection = collection.limit(limit);
    }

    const metadataList = await collection.toArray();

    return metadataList.map((metadata) =>
      Note.parse({ ...metadata, content: "" }),
    );
  }

  /**
   * Delete note: remove file + remove from IndexedDB
   */
  async delete(id: EntityBase["id"]): Promise<boolean> {
    const note: any = await db.notes.get(id);

    if (!note) {
      return false;
    }

    // Delete file if it exists
    if (note.filePath) {
      const deleteResult = await window.electronAPI.fs.deleteFile(
        note.filePath,
      );
      if (!deleteResult.success) {
        console.warn(
          `Failed to delete file ${note.filePath}:`,
          deleteResult.error,
        );
      }
    }

    // Remove from IndexedDB
    await db.notes.delete(id);

    return true;
  }
}
