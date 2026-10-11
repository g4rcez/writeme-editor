import Dexie, { type Table } from "dexie";
import {
    appendNoteComment,
    getCommentCompanion,
    getCommentReferenceHref,
    parseCommentThreads,
    uniqueCommentId,
} from "@/lib/note-comments";
import { Note } from "../../note";
import {
    noteCommentThreads,
    type NoteCommentThread,
    type CommentSourceUpdate,
    type CommentSaveResult,
} from "../../note-comment";
import { appendNoteSnapshot } from "../../note-history";
import { SettingsService } from "../../settings";
import { db } from "./dexie-db";

export async function syncCommentThreads(
    note: Note,
    table: Table<NoteCommentThread, [string, string]> = db.comments,
): Promise<void> {
    const sourceId = note.metadata?.commentSourceId;
    if (typeof sourceId !== "string") return;
    await table.where("referenceNoteId").equals(note.id).delete();
    if (!(await db.notes.get(sourceId))) return;
    const threads = noteCommentThreads(note);
    if (threads.length) await table.bulkPut(threads);
}

async function findCommentNote(source: Note): Promise<Note | null> {
    const thread = await db.comments.where("noteId").equals(source.id).first();
    if (thread) {
        const note = await db.notes.get(thread.referenceNoteId);
        if (note && !note.deletedAt && note.metadata?.commentSourceId === source.id) return Note.parse(note);
    }
    const companion = getCommentCompanion(source);
    const notes = await db.notes.toArray();
    const owned = notes.find((note) => note.metadata?.commentSourceId === source.id);
    if (owned?.deletedAt) throw new Error("The comments note is in Trash. Restore it before adding replies.");
    const existing =
        owned ??
        notes.find(
            (note) =>
                !note.deletedAt &&
                !note.metadata?.commentSourceId &&
                note.project === source.project &&
                (companion.filePath ? note.filePath === companion.filePath : note.title === companion.title),
        );
    return existing ? Note.parse(existing) : null;
}

export async function loadBrowserCommentNote(source: Note, observe = false): Promise<Note | null> {
    const existing = await findCommentNote(source);
    if (observe || !existing || existing.metadata.commentSourceId === source.id) return existing;
    return db.transaction("rw", [db.notes, db.comments], async () => {
        const note = await findCommentNote(source);
        if (note && note.metadata.commentSourceId !== source.id) {
            note.metadata = { ...note.metadata, commentSourceId: source.id };
            await db.notes.put(note);
            await syncCommentThreads(note);
        }
        return note;
    });
}

export async function saveBrowserNoteComment(
    source: Note,
    quote: string,
    body: string,
    threadId: string | null,
    usedIds: string[],
    prepareSource?: CommentSourceUpdate,
): Promise<CommentSaveResult> {
    if (!body.trim()) throw new Error("Write a comment before saving.");
    return db.transaction("rw", [db.notes, db.comments, db.noteHistory], async () => {
        const current = await db.notes.get(source.id);
        if (!current || current.deletedAt)
            throw new Error("The source note was deleted. Restore it before commenting.");
        if (prepareSource && (current.content !== source.content || current.title !== source.title)) {
            throw new Error("The source note changed in another editor. Reload it before saving your comment.");
        }
        const existing = await findCommentNote(source);
        const companion = getCommentCompanion(source);
        const id =
            threadId ??
            uniqueCommentId(quote, [
                ...usedIds,
                ...parseCommentThreads(existing?.content ?? "").map((thread) => thread.id),
            ]);
        const initial = `# ${companion.title}\n\nSource: [${source.title.replace(/[[\]\\]/g, "\\$&")}](/note/${source.id})\n`;
        const content = appendNoteComment(existing?.content ?? initial, id, quote, body);
        const author = SettingsService.load().defaultAuthor;
        const note = Note.parse({
            ...(existing ?? Note.new(companion.title, content)),
            content,
            project: source.project,
            metadata: { ...existing?.metadata, commentSourceId: source.id },
            createdBy: existing?.createdBy ?? author,
            updatedBy: author,
            updatedAt: new Date(),
            fileSize: content.length,
        });
        const href = getCommentReferenceHref(note);
        const sourceNote = prepareSource
            ? Note.parse({
                  ...current,
                  content: prepareSource(id, href),
                  metadata: {
                      ...current.metadata,
                      commentReferenceHrefs: Array.from(
                          new Set([
                              ...(Array.isArray(current.metadata?.commentReferenceHrefs)
                                  ? current.metadata.commentReferenceHrefs.filter(
                                        (value): value is string => typeof value === "string",
                                    )
                                  : []),
                              href,
                          ]),
                      ),
                  },
                  updatedAt: note.updatedAt,
                  updatedBy: author,
              })
            : undefined;
        if (sourceNote) {
            sourceNote.fileSize = sourceNote.content.length;
            await db.notes.put(sourceNote);
            const latestSource = await db.noteHistory
                .where("[noteId+createdAt]")
                .between([source.id, Dexie.minKey], [source.id, Dexie.maxKey])
                .last();
            const sourceSnapshot = appendNoteSnapshot(
                latestSource ? [latestSource] : [],
                source.id,
                sourceNote.content,
                sourceNote.updatedAt,
            )[0];
            if (sourceSnapshot && sourceSnapshot.id !== latestSource?.id) await db.noteHistory.add(sourceSnapshot);
        }
        await db.notes.put(note);
        await syncCommentThreads(note);
        const latest = await db.noteHistory
            .where("[noteId+createdAt]")
            .between([note.id, Dexie.minKey], [note.id, Dexie.maxKey])
            .last();
        const snapshot = appendNoteSnapshot(latest ? [latest] : [], note.id, content, note.updatedAt)[0];
        if (snapshot && snapshot.id !== latest?.id) await db.noteHistory.add(snapshot);
        return { note, id, source: sourceNote, href };
    });
}
