import { Note } from "../../note";
import { EntityBase, Repository } from "../../repository";
import { db } from "./dexie-db";
import { SettingsRepository } from "../../settings";
import {
  generateNotePath,
  getUniqueFilePath,
} from "../../../lib/file-utils";
import { getStorageMode } from "../../../lib/storage-mode";

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
   * Save new note: conditionally stores to filesystem or IndexedDB
   * - Filesystem mode: content in .md file, metadata in IndexedDB
   * - IndexedDB mode: full note (including content) in IndexedDB
   */
  async save(item: Note): Promise<Note> {
    const mode = getStorageMode();
    const settings = SettingsRepository.load();

    if (mode === "filesystem") {
      // Filesystem mode: write content to file, metadata to IndexedDB
      const filePath = generateNotePath(
        settings.storageDirectory!,
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
      item.filePath = uniquePath;
      item.fileSize = writeResult.fileSize;
      item.lastSynced = new Date(writeResult.lastModified);
      item.createdBy = settings.defaultAuthor;
      item.updatedBy = settings.defaultAuthor;

      // Save metadata (WITHOUT content) to IndexedDB
      const { content: _, ...metadata } = item as any;
      await db.notes.add(metadata, item.id);
    } else {
      // IndexedDB mode: store full note including content
      item.createdBy = settings.defaultAuthor;
      item.updatedBy = settings.defaultAuthor;
      item.fileSize = item.content.length;
      await db.notes.add(item as any, item.id);
    }

    return item;
  }

  async update(id: EntityBase["id"], item: Note): Promise<Note> {
    const mode = getStorageMode();
    const settings = SettingsRepository.load();
    if (item.filePath && !item.filePath.startsWith(settings.storageDirectory!) && mode === "filesystem") {
      const result = await window.electronAPI.fs.writeFile(
        item.filePath,
        item.content,
      );
      if (result.success) {
        item.lastSynced = new Date(result.lastModified);
        item.fileSize = result.fileSize;
      }
      return item;
    }
    const existing = await db.notes.get(id);
    if (!existing) {
      throw new Error(`Note ${id} not found`);
    }
    if (mode === "filesystem") {
      let filePath = existing.filePath;
      if (!filePath && (existing as any).content) {
        console.log("Lazy migration for note:", item.title);
        filePath = generateNotePath(
          settings.storageDirectory!,
          item.title,
        );
        const uniquePath = await getUniqueFilePath(filePath, async (path) => {
          const result = await window.electronAPI.fs.statFile(path);
          return result.exists;
        });
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
      if (existing.title !== item.title && filePath) {
        const newPath = generateNotePath(
          settings.storageDirectory!,
          item.title,
        );
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
      item.updatedAt = new Date();
      item.updatedBy = settings.defaultAuthor;
      const { content: _, ...metadata } = item as any;
      await db.notes.put(metadata, id);
    } else {
      item.updatedBy = settings.defaultAuthor;
      item.updatedAt = new Date();
      item.fileSize = item.content.length;
      await db.notes.put(item as any, id);
    }

    return item;
  }

  /**
   * Get single note: conditionally loads from filesystem or IndexedDB
   * - Filesystem mode: metadata from IndexedDB, content from .md file
   * - IndexedDB mode: full note from IndexedDB
   */
  async getOne(id: EntityBase["id"]): Promise<Note | null> {
    const metadata: any = await db.notes.get(id);

    if (!metadata) {
      return null;
    }

    const mode = getStorageMode();

    // If we have a filePath and filesystem access, load content from file
    if (mode === "filesystem" && metadata.filePath) {
      const readResult = await window.electronAPI.fs.readFile(
        metadata.filePath,
      );

      if (readResult.success) {
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
        return Note.parse({ ...metadata, content: readResult.content });
      } else {
        console.warn(`File not found for note ${id}: ${metadata.filePath}`);
        console.warn("Error:", readResult.error);
        // Fall through to check if content exists in IndexedDB
      }
    }

    // IndexedDB mode or fallback: content should be in metadata
    return Note.parse({ ...metadata, content: metadata.content || "" });
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
   * Get the most recently updated quicknote.
   * Returns null if no quicknotes exist.
   */
  async getLatestQuicknote(): Promise<Note | null> {
    const result = await db.notes
      .where("noteType")
      .equals("quicknote")
      .reverse()
      .sortBy("updatedAt");

    if (result.length === 0) return null;

    const metadata = result[0] as any;
    const mode = getStorageMode();

    if (mode === "filesystem" && metadata.filePath) {
      const readResult = await window.electronAPI.fs.readFile(metadata.filePath);
      if (readResult.success) {
        return Note.parse({ ...metadata, content: readResult.content });
      }
    }

    return Note.parse({ ...metadata, content: metadata.content || "" });
  }

  /**
   * Get a quicknote for a specific date.
   * Dates are compared by year, month, and day.
   */
  async getQuicknoteByDate(date: Date): Promise<Note | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await db.notes
      .where("noteType")
      .equals("quicknote")
      .and((note) => {
        const noteDate = new Date(note.updatedAt);
        return noteDate >= startOfDay && noteDate <= endOfDay;
      })
      .toArray();

    if (result.length === 0) return null;

    // Return the first one found for that day
    const metadata = result[0] as any;
    const mode = getStorageMode();

    if (mode === "filesystem" && metadata.filePath) {
      const readResult = await window.electronAPI.fs.readFile(metadata.filePath);
      if (readResult.success) {
        return Note.parse({ ...metadata, content: readResult.content });
      }
    }

    return Note.parse({ ...metadata, content: metadata.content || "" });
  }

  /**
   * Delete note: conditionally removes from filesystem and/or IndexedDB
   * - Filesystem mode with filePath: delete file + remove from IndexedDB
   * - IndexedDB mode: just remove from IndexedDB
   */
  async delete(id: EntityBase["id"]): Promise<boolean> {
    const note: any = await db.notes.get(id);

    if (!note) {
      return false;
    }

    const mode = getStorageMode();

    // Delete file if we're in filesystem mode and file exists
    if (mode === "filesystem" && note.filePath) {
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
