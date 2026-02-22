import { endOfDay, startOfDay } from "date-fns";
import { generateNotePath, getUniqueFilePath } from "../../../lib/file-utils";
import { getStorageMode } from "../../../lib/storage-mode";
import { INoteRepository, Note } from "../../note";
import { EntityBase } from "../../repository";
import { SettingsService } from "../../settings";
import { BaseRepository } from "../base.repository";
import { ElectronStorageAdapter } from "../adapters/electron.adapter";
import { ITabRepository } from "../entities/tab";

export class NotesRepository extends BaseRepository<Note> implements INoteRepository {
  constructor(private readonly tabsRepository: ITabRepository) {
    super(new ElectronStorageAdapter(), "notes", (a, b) => +b.updatedAt - +a.updatedAt);
  }

  async save(item: Note): Promise<Note> {
    const mode = getStorageMode();
    const settings = SettingsService.load();

    if (mode === "filesystem") {
      const filePath = generateNotePath(settings.directory!, item.title);
      const uniquePath = await getUniqueFilePath(filePath, async (path) => {
        const result = await window.electronAPI.fs.statFile(path);
        return result.exists;
      });
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
      const { content: _, ...metadata } = item as any;
      await this.adapter.save(this.collection, { ...metadata, id: item.id });
    } else {
      item.createdBy = settings.defaultAuthor;
      item.updatedBy = settings.defaultAuthor;
      item.fileSize = item.content.length;
      await this.adapter.save(this.collection, { ...item, id: item.id });
    }
    return item;
  }

  async update(id: EntityBase["id"], item: Note): Promise<Note> {
    const mode = getStorageMode();
    const settings = SettingsService.load();
    if (
      item.filePath &&
      !item.filePath.startsWith(settings.directory!) &&
      mode === "filesystem"
    ) {
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
    const existing = await this.getOne(id);
    if (!existing) {
      throw new Error(`Note ${id} not found`);
    }
    if (mode === "filesystem") {
      let filePath = existing.filePath;
      if (!filePath && (existing as any).content) {
        console.log("Lazy migration for note:", item.title);
        filePath = generateNotePath(settings.directory!, item.title);
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
        const newPath = generateNotePath(settings.directory!, item.title);
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
      await this.adapter.save(this.collection, { ...metadata, id });
    } else {
      item.updatedBy = settings.defaultAuthor;
      item.updatedAt = new Date();
      item.fileSize = item.content.length;
      await this.adapter.save(this.collection, { ...item, id });
    }

    return item;
  }

  async getOne(id: EntityBase["id"]): Promise<Note | null> {
    const metadata: any = await this.adapter.get(this.collection, id);
    if (!metadata) {
      return null;
    }
    const mode = getStorageMode();
    if (mode === "filesystem" && metadata.filePath) {
      const readResult = await window.electronAPI.fs.readFile(
        metadata.filePath,
      );
      if (readResult.success) {
        const fileModified = new Date(readResult.lastModified);
        if (
          metadata.lastSynced &&
          new Date(metadata.lastSynced) < fileModified
        ) {
          metadata.lastSynced = fileModified.toISOString();
          metadata.fileSize = readResult.fileSize;
          await this.adapter.save(this.collection, { ...metadata, id });
        }
        return Note.parse({ ...metadata, content: readResult.content });
      } else {
        console.warn(`File not found for note ${id}: ${metadata.filePath}`);
        console.warn("Error:", readResult.error);
        return null;
      }
    }
    return Note.parse({ ...metadata, content: metadata.content || "" });
  }

  async getAll(query?: { limit?: number }): Promise<Note[]> {
    const all = await this.adapter.getAll<Note>(this.collection);
    const notes = all.map((metadata: any) =>
      Note.parse({ ...metadata, content: "" }),
    );
    const sorted = notes.toSorted((a, b) => +b.updatedAt - +a.updatedAt);
    if (query?.limit) {
      return sorted.slice(0, query.limit);
    }
    return sorted;
  }

  async getRecentNotes(limit?: number): Promise<Note[]> {
    const metadataList = await window.electronAPI.db.notes.getRecentNotes(
      limit || 20,
    );
    return metadataList.map((metadata: any) =>
      Note.parse({ ...metadata, content: "" }),
    );
  }

  async getLatestQuicknote(): Promise<Note | null> {
    const metadata = await window.electronAPI.db.notes.getLatestQuicknote();
    if (!metadata) return null;

    const mode = getStorageMode();

    if (mode === "filesystem" && metadata.filePath) {
      const readResult = await window.electronAPI.fs.readFile(
        metadata.filePath,
      );
      if (readResult.success) {
        return Note.parse({ ...metadata, content: readResult.content });
      }
    }

    return Note.parse({ ...metadata, content: metadata.content || "" });
  }

  async getQuicknoteByDate(date: Date): Promise<Note | null> {
    const datetime = new Date(date);
    const start = startOfDay(datetime).toISOString();
    const end = endOfDay(datetime).toISOString();

    const metadata = await window.electronAPI.db.notes.getQuicknoteByDate(
      start,
      end,
    );
    if (!metadata) return null;

    const mode = getStorageMode();
    if (mode === "filesystem" && metadata.filePath) {
      const readResult = await window.electronAPI.fs.readFile(
        metadata.filePath,
      );
      if (readResult.success) {
        return Note.parse({ ...metadata, content: readResult.content });
      }
    }
    return Note.parse({ ...metadata, content: metadata.content || "" });
  }

  async getTemplates(): Promise<Note[]> {
    const metadataList = await window.electronAPI.db.notes.getTemplates();
    const notes = metadataList.map((metadata: any) =>
      Note.parse({ ...metadata, content: "" }),
    );

    const mode = getStorageMode();
    if (mode === "filesystem") {
      return await Promise.all(
        notes.map(async (n) => {
          if (n.filePath) {
            const result = await window.electronAPI.fs.readFile(n.filePath);
            if (result.success) {
              n.content = result.content;
            }
          }
          return n;
        }),
      );
    }

    return await Promise.all(
      notes.map(async (n) => {
        const full = await this.getOne(n.id);
        return full || n;
      }),
    );
  }

  async delete(id: EntityBase["id"]): Promise<boolean> {
    const note: any = await this.adapter.get(this.collection, id);
    if (!note) {
      return false;
    }
    const mode = getStorageMode();
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

    await this.adapter.delete(this.collection, id);
    await this.tabsRepository.deleteByNoteId(id);

    return true;
  }

  async updateContent(id: string, content: string): Promise<void> {
    const mode = getStorageMode();
    const settings = SettingsService.load();
    const existing = await this.getOne(id);

    if (!existing) {
      throw new Error(`Note ${id} not found`);
    }

    const updatedAt = new Date();
    const updatedBy = settings.defaultAuthor;

    if (mode === "filesystem" && existing.filePath) {
      const writeResult = await window.electronAPI.fs.writeFile(
        existing.filePath,
        content,
      );
      if (!writeResult.success) {
        throw new Error(`Failed to update file: ${writeResult.error}`);
      }
      const fileSize = writeResult.fileSize;
      const lastSynced = new Date(writeResult.lastModified);
      const metadata = {
        ...existing,
        id,
        fileSize,
        lastSynced,
        updatedAt,
        updatedBy,
      } as any;
      delete metadata.content;
      await this.adapter.save(this.collection, metadata);
    } else {
      await window.electronAPI.db.notes.updateContent(
        id,
        content,
        content.length,
        updatedAt.toISOString(),
        updatedBy,
      );
    }
  }
}
