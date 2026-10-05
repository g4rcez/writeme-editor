import { v7 as uuid } from "uuid";

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
        return ordered;
    }

    return [
        {
            id: uuid(),
            noteId,
            content,
            createdAt: new Date(createdAt),
        },
        ...ordered,
    ];
}
