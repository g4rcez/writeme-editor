import { endOfDay, startOfDay } from "date-fns";
import { generateNotePath, getUniqueFilePath } from "../../../lib/file-utils";
import { getStorageMode } from "../../../lib/storage-mode";
import { type INoteRepository, Note } from "../../note";
import type { EntityBase } from "../../repository";
import { SettingsService } from "../../settings";
import { BaseRepository } from "../base.repository";
import { ElectronStorageAdapter } from "../adapters/electron.adapter";
import type { ITabRepository } from "../entities/tab";

export class NotesRepository
  extends BaseRepository<Note>
  implements INoteRepository
{
  public constructor(private readonly tabsRepository: ITabRepository) {
    super(
      new ElectronStorageAdapter(),
      "notes",
      (a, b) => +b.updatedAt - +a.updatedAt,
    );
  }

  override async save(item: Note): Promise<Note> {
    const settings = SettingsService.load();
    const mode = getStorageMode(settings.directory);

    if (mode === "filesystem") {
      if (!item.filePath) {
        const rootDir =
          item.noteType === "quick" || item.noteType === "math"
            ? (settings.quicknotesDirectory ??
              `${settings.directory!}/quicknotes`)
            : settings.directory!;
        const filePath = generateNotePath(rootDir, item.title);
        const uniquePath = await getUniqueFilePath(filePath, async (path) => {
          const result = await window.electronAPI.fs.statFile(path);
          return result.exists;
        });
        const writeResult = await window.electronAPI.fs.writeFile(
          uniquePath,
          typeof item.content === "string" ? item.content : "",
        );
        if (!writeResult.success) {
          throw new Error(`Failed to write file: ${writeResult.error}`);
        }
        item.filePath = uniquePath;
        item.fileSize = writeResult.fileSize;
        item.lastSynced = new Date(writeResult.lastModified);
      } else {
        item.fileSize =
          item.fileSize ||
          (typeof item.content === "string" ? item.content.length : 0);
        item.lastSynced = item.lastSynced || new Date();
      }
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

  override async update(id: EntityBase["id"], item: Note): Promise<Note> {
    const settings = SettingsService.load();
    const mode = getStorageMode(settings.directory);
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

  override async getOne(id: EntityBase["id"]): Promise<Note | null> {
    const metadata = await this.adapter.get<Note>(this.collection, id);
    if (!metadata) return null;
    if ((metadata as any).deletedAt != null) return null;
    const settings = SettingsService.load();
    const mode = getStorageMode(settings.directory);
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
          metadata.updatedAt = fileModified;
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

  override async getAll(query?: { limit?: number }): Promise<Note[]> {
    const all = await this.adapter.getAll<Note>(this.collection);
    const settings = SettingsService.load();
    const mode = getStorageMode(settings.directory);

    let filtered = all.filter((n) => (n as any).deletedAt == null);
    if (mode === "filesystem" && settings.directory) {
      filtered = filtered.filter(
        (n) => !n.filePath || n.filePath.startsWith(settings.directory!),
      );
    }

    const notes = filtered.map((metadata: any) =>
      Note.parse({ ...metadata, content: "" }),
    );
    const sorted = notes.toSorted((a, b) => +b.updatedAt - +a.updatedAt);
    if (query?.limit) {
      return sorted.slice(0, query.limit);
    }
    return sorted;
  }

  async getRecentNotes(limit?: number): Promise<Note[]> {
    const notes = await window.electronAPI.db.notes.getRecentNotes(
      Number.MAX_SAFE_INTEGER,
    );
    const settings = SettingsService.load();
    const mode = getStorageMode(settings.directory);

    let filtered = notes;
    if (mode === "filesystem" && settings.directory) {
      filtered = notes.filter(
        (n) => !n.filePath || n.filePath.startsWith(settings.directory!),
      );
    }

    const parsed = filtered.map((note) => Note.parse({ ...note, content: "" }));

    if (limit) {
      return parsed.slice(0, limit);
    }

    return parsed;
  }

  async getLatestQuicknote(): Promise<Note | null> {
    const metadata = await window.electronAPI.db.notes.getLatestQuicknote();
    if (!metadata) return null;

    const settings = SettingsService.load();
    const mode = getStorageMode(settings.directory);

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

    const settings = SettingsService.load();
    const mode = getStorageMode(settings.directory);
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

    const settings = SettingsService.load();
    const mode = getStorageMode(settings.directory);
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

  override async delete(id: EntityBase["id"]): Promise<boolean> {
    const settings = SettingsService.load();
    const mode = getStorageMode(settings.directory);
    if (mode === "filesystem") {
      const raw: any = await this.adapter.get(this.collection, id);
      if (raw?.filePath && settings.directory) {
        const basename = raw.filePath.split("/").pop() ?? `${id}.md`;
        const trashPath = `${settings.directory}/.trash/${id}-${basename}`;
        const moveResult = await window.electronAPI.fs.moveFile(
          raw.filePath,
          trashPath,
        );
        if (moveResult.success) {
          await window.electronAPI.db.notes.moveToTrash(
            id,
            trashPath,
            raw.filePath,
            new Date().toISOString(),
          );
        } else {
          // file couldn't be moved — soft-delete in place so the DB record is consistent
          await window.electronAPI.db.notes.softDelete(
            id,
            new Date().toISOString(),
          );
        }
      } else {
        await window.electronAPI.db.notes.softDelete(
          id,
          new Date().toISOString(),
        );
      }
    } else {
      await window.electronAPI.db.notes.softDelete(
        id,
        new Date().toISOString(),
      );
    }
    await this.tabsRepository.deleteByNoteId(id);
    return true;
  }

  async hardDelete(id: EntityBase["id"]): Promise<boolean> {
    const note: any = await this.adapter.get(this.collection, id);
    if (!note) {
      return false;
    }
    const settings = SettingsService.load();
    const mode = getStorageMode(settings.directory);
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
    await window.electronAPI.db.notes.hardDelete(id);
    await this.tabsRepository.deleteByNoteId(id);
    return true;
  }

  async restore(id: string): Promise<Note | null> {
    const settings = SettingsService.load();
    const mode = getStorageMode(settings.directory);
    if (mode === "filesystem") {
      const raw: any = await this.adapter.get(this.collection, id);
      if (raw?.filePath && raw?.originalFilePath) {
        const moveResult = await window.electronAPI.fs.moveFile(
          raw.filePath,
          raw.originalFilePath,
        );
        if (!moveResult.success) {
          const sourceCheck = await window.electronAPI.fs.statFile(
            raw.filePath,
          );
          if (!sourceCheck.exists) {
            await window.electronAPI.db.notes.restoreFromTrash(id);
          } else {
            await window.electronAPI.db.notes.restore(id);
          }
        } else {
          await window.electronAPI.db.notes.restoreFromTrash(id);
        }
      } else {
        await window.electronAPI.db.notes.restore(id);
      }
    } else {
      await window.electronAPI.db.notes.restore(id);
    }
    const note = await this.getOne(id);
    if (note) return note;
    const refreshed: any = await this.adapter.get(this.collection, id);
    if (!refreshed || refreshed.deletedAt != null) return null;
    return Note.parse({ ...refreshed, content: "" });
  }

  async getTrashed(): Promise<Note[]> {
    const rows = await window.electronAPI.db.notes.getTrashed();
    return rows.map((r: any) => Note.parse({ ...r, content: "" }));
  }

  async emptyTrash(): Promise<void> {
    const trashed = await window.electronAPI.db.notes.getTrashed();
    const settings = SettingsService.load();
    const mode = getStorageMode(settings.directory);
    for (const note of trashed) {
      if (mode === "filesystem" && note.filePath) {
        const result = await window.electronAPI.fs.deleteFile(note.filePath);
        if (!result.success) {
          console.warn(
            `Failed to delete trashed file ${note.filePath}:`,
            result.error,
          );
        }
      }
      await this.tabsRepository.deleteByNoteId(note.id);
    }
    await window.electronAPI.db.notes.emptyTrash();
  }

  async purgeBefore(cutoff: Date): Promise<void> {
    const cutoffIso = cutoff.toISOString();
    const trashed = await window.electronAPI.db.notes.getTrashed();
    const settings = SettingsService.load();
    const mode = getStorageMode(settings.directory);
    for (const note of trashed) {
      const deletedAt = (note as any).deletedAt;
      if (!deletedAt || new Date(deletedAt) >= cutoff) continue;
      if (mode === "filesystem" && note.filePath) {
        const result = await window.electronAPI.fs.deleteFile(note.filePath);
        if (!result.success) {
          console.warn(
            `Failed to delete purged file ${note.filePath}:`,
            result.error,
          );
        }
      }
      await this.tabsRepository.deleteByNoteId(note.id);
    }
    await window.electronAPI.db.notes.purgeBefore(cutoffIso);
  }

  async updateContent(id: string, content: string): Promise<void> {
    const settings = SettingsService.load();
    const mode = getStorageMode(settings.directory);
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
