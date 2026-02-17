import { endOfDay, startOfDay } from "date-fns";
import { INoteRepository, Note } from "../../note";
import { EntityBase } from "../../repository";
import { SettingsRepository } from "../../settings";
import { db } from "./dexie-db";

export class NotesRepository implements INoteRepository {
  async count(): Promise<number> {
    return await db.notes.count();
  }

  async save(item: Note): Promise<Note> {
    const settings = SettingsRepository.load();
    item.createdBy = settings.defaultAuthor;
    item.updatedBy = settings.defaultAuthor;
    item.fileSize = item.content.length;
    await db.notes.add(item as any, item.id);
    return item;
  }

  async update(id: EntityBase["id"], item: Note): Promise<Note> {
    const settings = SettingsRepository.load();
    const existing = await db.notes.get(id);
    if (!existing) {
      throw new Error(`Note ${id} not found`);
    }

    item.updatedBy = settings.defaultAuthor;
    item.updatedAt = new Date();
    item.fileSize = item.content.length;
    await db.notes.put(item as any, id);

    return item;
  }

  async getOne(id: EntityBase["id"]): Promise<Note | null> {
    const metadata: any = await db.notes.get(id);
    if (!metadata) {
      return null;
    }
    return Note.parse({ ...metadata, content: metadata.content || "" });
  }

  async getAll(query?: { limit?: number }): Promise<Note[]> {
    let collection = db.notes.toCollection();
    if (query?.limit) {
      collection = collection.limit(query.limit);
    }
    const metadataList = await collection.toArray();
    return metadataList
      .map((metadata) =>
        Note.parse({ ...metadata, content: metadata.content || "" }),
      )
      .toSorted((a, b) => +b.updatedAt - +a.updatedAt);
  }

  async getRecentNotes(limit?: number): Promise<Note[]> {
    let collection = db.notes.orderBy("updatedAt").reverse();
    if (limit) {
      collection = collection.limit(limit);
    }
    const metadataList = await collection.toArray();

    return metadataList.map((metadata) =>
      Note.parse({ ...metadata, content: metadata.content || "" }),
    );
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

  async delete(id: EntityBase["id"]): Promise<boolean> {
    const note: any = await db.notes.get(id);

    if (!note) {
      return false;
    }

    await db.notes.delete(id);
    return true;
  }
}
