import { endOfDay, startOfDay } from "date-fns";
import { type INoteRepository, Note, type NoteDeletionOutcome } from "../../note";
import { type EntityBase } from "../../repository";
import { SettingsService } from "../../settings";
import { db } from "./dexie-db";
import { BaseRepository } from "../base.repository";
import { DexieStorageAdapter } from "../adapters/dexie.adapter";
import { type ITabRepository } from "../entities/tab";

export class NotesRepository
  extends BaseRepository<Note>
  implements INoteRepository
{
  constructor(private readonly tabsRepository: ITabRepository) {
    super(
      new DexieStorageAdapter(),
      "notes",
      (a, b) => +b.updatedAt - +a.updatedAt,
    );
  }

  override async delete(id: EntityBase["id"]): Promise<boolean> {
    await db.notes.update(id, { deletedAt: new Date() } as any);
    await this.tabsRepository.deleteByNoteId(id);
    return true;
  }

  async hardDelete(id: EntityBase["id"]): Promise<boolean> {
    if (!(await db.notes.get(id))) return false;
    await db.transaction(
      "rw",
      [
        db.notes,
        db.tabs,
        db.noteGroupMembers,
        db.cursorPositions,
        db.aiChats,
        db.aiMessages,
      ],
      async () => {
        const chatIds = (await db.aiChats
          .where("noteId")
          .equals(id)
          .primaryKeys()) as string[];
        if (chatIds.length) {
          await db.aiMessages.where("chatId").anyOf(chatIds).delete();
        }
        await db.aiChats.where("noteId").equals(id).delete();
        await db.tabs.where("noteId").equals(id).delete();
        await db.noteGroupMembers.where("noteId").equals(id).delete();
        await db.cursorPositions.where("noteId").equals(id).delete();
        await db.notes.delete(id);
      },
    );
    return true;
  }

  async restore(id: string): Promise<Note | null> {
    await db.notes.update(id, { deletedAt: null } as any);
    return this.getOne(id);
  }

  async getTrashed(): Promise<Note[]> {
    const all = await db.notes.toArray();
    return all
      .filter((n) => (n as any).deletedAt != null)
      .map((n) => Note.parse({ ...n, content: (n as any).content || "" }))
      .sort(
        (a, b) =>
          +new Date((b as any).deletedAt) - +new Date((a as any).deletedAt),
      );
  }

  async purgeBefore(cutoff: Date): Promise<NoteDeletionOutcome> {
    const all = await db.notes.toArray();
    const ids = all
      .filter((n) => {
        const deletedAt = (n as any).deletedAt;
        return deletedAt != null && new Date(deletedAt) < cutoff;
      })
      .map((n) => n.id);
    const outcome = { deleted: 0, failed: 0 };
    for (const id of ids) {
      outcome[(await this.hardDelete(id)) ? "deleted" : "failed"]++;
    }
    return outcome;
  }

  async emptyTrash(): Promise<NoteDeletionOutcome> {
    const trashed = await db.notes.toArray();
    const ids = trashed
      .filter((n) => (n as any).deletedAt != null)
      .map((n) => n.id);
    const outcome = { deleted: 0, failed: 0 };
    for (const id of ids) {
      outcome[(await this.hardDelete(id)) ? "deleted" : "failed"]++;
    }
    return outcome;
  }

  override async save(item: Note): Promise<Note> {
    const settings = SettingsService.load();
    item.createdBy = settings.defaultAuthor;
    item.updatedBy = settings.defaultAuthor;
    item.fileSize = item.content.length;
    return await super.save(item);
  }

  override async update(id: EntityBase["id"], item: Note): Promise<Note> {
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

  override async getOne(id: EntityBase["id"]): Promise<Note | null> {
    const metadata: any = await super.getOne(id);
    if (!metadata) return null;
    if (metadata.deletedAt != null) return null;
    return Note.parse({ ...metadata, content: metadata.content || "" });
  }

  override async getAll(query?: { limit?: number }): Promise<Note[]> {
    const items = await super.getAll(query);
    return items
      .filter((n) => (n as any).deletedAt == null)
      .map((metadata) =>
        Note.parse({ ...metadata, content: metadata.content || "" }),
      );
  }

  async getRecentNotes(limit?: number): Promise<Note[]> {
    const metadataList = await db.notes
      .where("noteType")
      .notEqual("template")
      .and((n) => (n as any).deletedAt == null)
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
      .and((n) => (n as any).deletedAt == null)
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
        if ((note as any).deletedAt != null) return false;
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
      .and((n) => (n as any).deletedAt == null)
      .toArray();

    return result.map((metadata) =>
      Note.parse({ ...metadata, content: metadata.content || "" }),
    );
  }

  async updateContent(id: string, content: string): Promise<void> {
    const settings = SettingsService.load();
    await db.notes.update(id, {
      content,
      fileSize: content.length,
      updatedAt: new Date(),
      updatedBy: settings.defaultAuthor,
    });
  }
}
