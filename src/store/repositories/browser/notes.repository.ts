import { endOfDay, startOfDay } from "date-fns";
import type { EntityBase } from "../../repository";
import type { ITabRepository } from "../entities/tab";
import { type INoteRepository, Note, type NoteDeletionOutcome } from "../../note";
import { appendNoteSnapshot, type NoteSnapshot } from "../../note-history";
import { SettingsService } from "../../settings";
import { DexieStorageAdapter } from "../adapters/dexie.adapter";
import { BaseRepository } from "../base.repository";
import { db } from "./dexie-db";

export class NotesRepository extends BaseRepository<Note> implements INoteRepository {
    constructor(private readonly tabsRepository: ITabRepository) {
        super(new DexieStorageAdapter(), "notes", (a, b) => +b.updatedAt - +a.updatedAt);
    }

    private async saveSnapshot(noteId: string, content: string, createdAt: Date): Promise<void> {
        await db.transaction("rw", db.noteHistory, async () => {
            const existingRows = await db.noteHistory.where("noteId").equals(noteId).toArray();
            const existing = existingRows.map((snapshot) => ({
                ...snapshot,
                createdAt: new Date(snapshot.createdAt),
            }));
            const next = appendNoteSnapshot(existing, noteId, content, createdAt);
            const existingIds = new Set(existing.map((snapshot) => snapshot.id));
            const added = next.find((snapshot) => !existingIds.has(snapshot.id));
            if (added) await db.noteHistory.add(added);

            const keptIds = new Set(next.map((snapshot) => snapshot.id));
            const staleIds = existing.filter((snapshot) => !keptIds.has(snapshot.id)).map((snapshot) => snapshot.id);
            if (staleIds.length > 0) await db.noteHistory.bulkDelete(staleIds);
        });
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
            [db.notes, db.noteHistory, db.tabs, db.noteGroupMembers, db.cursorPositions, db.aiChats, db.aiMessages],
            async () => {
                const chatIds = (await db.aiChats.where("noteId").equals(id).primaryKeys()) as string[];
                if (chatIds.length) {
                    await db.aiMessages.where("chatId").anyOf(chatIds).delete();
                }
                await db.aiChats.where("noteId").equals(id).delete();
                await db.tabs.where("noteId").equals(id).delete();
                await db.noteGroupMembers.where("noteId").equals(id).delete();
                await db.cursorPositions.where("noteId").equals(id).delete();
                await db.noteHistory.where("noteId").equals(id).delete();
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
            .sort((a, b) => +new Date((b as any).deletedAt) - +new Date((a as any).deletedAt));
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
        const ids = trashed.filter((n) => (n as any).deletedAt != null).map((n) => n.id);
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
        const saved = await super.save(item);
        await this.saveSnapshot(saved.id, saved.content, saved.updatedAt);
        return saved;
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
        const updated = await super.update(id, item);
        if (existing.content !== updated.content) {
            await this.saveSnapshot(updated.id, updated.content, updated.updatedAt);
        }
        return updated;
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
            .map((metadata) => Note.parse({ ...metadata, content: metadata.content || "" }));
    }

    async getRecentNotes(limit?: number): Promise<Note[]> {
        const metadataList = await db.notes
            .where("noteType")
            .notEqual("template")
            .and((n) => (n as any).deletedAt == null)
            .toArray();

        const sorted = metadataList
            .map((metadata) => Note.parse({ ...metadata, content: (metadata as any).content || "" }))
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

        return result.map((metadata) => Note.parse({ ...metadata, content: metadata.content || "" }));
    }

    async getHistory(noteId: string): Promise<NoteSnapshot[]> {
        const snapshots = await db.noteHistory.where("noteId").equals(noteId).toArray();
        return snapshots
            .map((snapshot) => ({
                ...snapshot,
                createdAt: new Date(snapshot.createdAt),
            }))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    async restoreSnapshot(noteId: string, snapshotId: string): Promise<Note | null> {
        const snapshot = await db.noteHistory.get(snapshotId);
        if (!snapshot || snapshot.noteId !== noteId) return null;
        await this.updateContent(noteId, snapshot.content);
        return this.getOne(noteId);
    }

    async updateContent(id: string, content: string): Promise<void> {
        const settings = SettingsService.load();
        const existing = await this.getOne(id);
        if (!existing) {
            throw new Error(`Note ${id} not found`);
        }

        const updatedAt = new Date();
        await db.notes.update(id, {
            content,
            fileSize: content.length,
            updatedAt,
            updatedBy: settings.defaultAuthor,
        });
        if (existing.content !== content) {
            await this.saveSnapshot(id, content, updatedAt);
        }
    }
}
