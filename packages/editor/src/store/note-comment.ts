import { parseCommentThreads, type CommentThread } from "@/lib/note-comments";
import type { Note } from "./note";

export type NoteCommentThread = CommentThread & {
    noteId: string;
    referenceNoteId: string;
    position: number;
    updatedAt: Date;
};

export type CommentSourceUpdate = (id: string, href: string) => string;
export type CommentSaveResult = { note: Note; id: string; source?: Note; href?: string };

export function noteCommentThreads(note: Note): NoteCommentThread[] {
    const noteId = note.metadata?.commentSourceId;
    if (typeof noteId !== "string") return [];
    return parseCommentThreads(note.content).map((thread, position) => ({
        ...thread,
        noteId,
        referenceNoteId: note.id,
        position,
        updatedAt: note.updatedAt,
    }));
}
