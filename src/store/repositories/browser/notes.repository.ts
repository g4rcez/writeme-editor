import { endOfDay, startOfDay } from "date-fns";
import { INoteRepository, Note } from "../../note";
import { EntityBase } from "../../repository";
import { SettingsService } from "../../settings";
import { db } from "./dexie-db";
import { BaseRepository } from "../base.repository";
import { DexieStorageAdapter } from "../adapters/dexie.adapter";

export class NotesRepository extends BaseRepository<Note> implements INoteRepository {
  constructor() {
    super(new DexieStorageAdapter(), "notes", (a, b) => +b.updatedAt - +a.updatedAt);
  }

  async save(item: Note): Promise<Note> {
    const settings = SettingsService.load();
    item.createdBy = settings.defaultAuthor;
    item.updatedBy = settings.defaultAuthor;
    item.fileSize = item.content.length;
    return await super.save(item);
  }

  async update(id: EntityBase["id"], item: Note): Promise<Note> {
    const settings = SettingsService.load();
    const existing = await this.getOne(id);
    if (!existing) {
      throw new Error(`Note ${id} not found`);
    }

    item.updatedBy = settings.defaultAuthor;
    item.updatedAt = new Date();
    item.fileSize = item.content.length;
    return await super.update(id, item);
  }

  async getOne(id: EntityBase["id"]): Promise<Note | null> {
    const metadata: any = await super.getOne(id);
    if (!metadata) {
      return null;
    }
    return Note.parse({ ...metadata, content: metadata.content || "" });
  }

  async getAll(query?: { limit?: number }): Promise<Note[]> {
    const items = await super.getAll(query);
    return items.map((metadata) =>
      Note.parse({ ...metadata, content: metadata.content || "" }),
    );
  }

  async getRecentNotes(limit?: number): Promise<Note[]> {
    const metadataList = await db.notes
      .where("noteType")
      .notEqual("template")
      .toArray();

    const sorted = metadataList
      .map((metadata) =>
        Note.parse({ ...metadata, content: (metadata as any).content || "" }),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    if (limit) {
      return sorted.slice(0, limit);
    }

    return sorted;
  }

  async getLatestQuicknote(): Promise<Note | null> {
    const result = await db.notes
      .where("noteType")
      .equals("quick")
      .reverse()
      .sortBy("updatedAt");

    if (result.length === 0) return null;

    const metadata = result[0] as any;
    return Note.parse({ ...metadata, content: metadata.content || "" });
  }

  async getQuicknoteByDate(date: Date): Promise<Note | null> {
    const datetime = new Date(date);
    const start = startOfDay(datetime);
    const end = endOfDay(datetime);
    const result = await db.notes
      .where("noteType")
      .equals("quick")
      .and((note) => {
        const noteDate = new Date(note.updatedAt);
        return noteDate >= start && noteDate <= end;
      })
      .toArray();
    if (result.length === 0) return null;
    const metadata = result[0] as any;
    return Note.parse({ ...metadata, content: metadata.content || "" });
  }

  async getTemplates(): Promise<Note[]> {
    const result = await db.notes
      .where("noteType")
      .equals("template")
      .toArray();

    return result.map((metadata) =>
      Note.parse({ ...metadata, content: metadata.content || "" }),
    );
  }
}
