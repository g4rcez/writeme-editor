import { v7 as uuid } from "uuid";

export const NOTE_HISTORY_LIMIT = 50;

export type NoteSnapshot = Readonly<{
    id: string;
    noteId: string;
    content: string;
    createdAt: Date;
}>;

export function appendNoteSnapshot(
    snapshots: readonly NoteSnapshot[],
    noteId: string,
    content: string,
    createdAt = new Date(),
): NoteSnapshot[] {
    const ordered = [...snapshots].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (ordered[0]?.content === content) {
        return ordered.slice(0, NOTE_HISTORY_LIMIT);
    }

    return [
        {
            id: uuid(),
            noteId,
            content,
            createdAt: new Date(createdAt),
        },
        ...ordered,
    ].slice(0, NOTE_HISTORY_LIMIT);
}
