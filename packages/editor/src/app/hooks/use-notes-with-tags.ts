import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Note } from "@/store/note";
import type { Hashtag } from "@/store/repositories/entities/hashtag";
import { HASHTAGS_CHANGED_EVENT } from "@/lib/hashtag-events";
import { repositories } from "@/store/repositories";

export type NoteWithTags = Note & { tagCount: number };
type TagIndex = ReadonlyMap<string, readonly string[]>;
type TagState = { workspace: string | null; index: TagIndex; ready: boolean; error: unknown };
const emptyIndex: TagIndex = new Map();

function indexHashtags(hashtags: Hashtag[]): TagIndex {
    const index = new Map<string, string[]>();
    for (const hashtag of hashtags) {
        const tags = index.get(hashtag.filename) ?? [];
        if (!tags.includes(hashtag.hashtag)) tags.push(hashtag.hashtag);
        index.set(hashtag.filename, tags);
    }
    return index;
}

function sameIndex(left: TagIndex, right: TagIndex): boolean {
    if (left.size !== right.size) return false;
    for (const [filename, tags] of left) {
        const next = right.get(filename);
        if (!next || tags.length !== next.length || tags.some((tag, index) => tag !== next[index])) return false;
    }
    return true;
}

function createNoteProjection() {
    const rows = new WeakMap<Note, { index: TagIndex; row: NoteWithTags }>();
    return (notes: Note[], index: TagIndex): NoteWithTags[] => notes.map((note) => {
        const cached = rows.get(note);
        if (cached?.index === index) return cached.row;
        const tags = [...new Set([...note.tags, ...(index.get(note.filePath || note.title) ?? [])])];
        const row = { ...note, tags, tagCount: tags.length } as NoteWithTags;
        rows.set(note, { index, row });
        return row;
    });
}

export function useNotesWithTags(notes: Note[], directory: string | null) {
    const workspace = directory ?? null;
    const [state, setState] = useState<TagState>({ workspace, index: emptyIndex, ready: false, error: null });
    const request = useRef(0);
    const activeWorkspace = useRef<string | null | undefined>(undefined);
    const projectNotes = useMemo(() => createNoteProjection(), []);
    const refresh = useCallback(async (): Promise<void> => {
        if (activeWorkspace.current !== workspace) return;
        const version = ++request.current;
        try {
            const index = indexHashtags(await repositories.hashtags.getAll());
            if (version !== request.current) return;
            setState((previous) => {
                if (version !== request.current) return previous;
                const previousIndex = previous.workspace === workspace ? previous.index : emptyIndex;
                return { workspace, index: sameIndex(previousIndex, index) ? previousIndex : index, ready: true, error: null };
            });
        } catch (error) {
            if (version !== request.current) return;
            console.error("Failed to load note hashtags:", error);
            setState((previous) => version === request.current ? {
                workspace,
                index: previous.workspace === workspace ? previous.index : emptyIndex,
                ready: true,
                error,
            } : previous);
        }
    }, [workspace]);

    useEffect(() => {
        activeWorkspace.current = workspace;
        const changed = (): void => { void refresh(); };
        window.addEventListener(HASHTAGS_CHANGED_EVENT, changed);
        void refresh();
        return () => {
            activeWorkspace.current = undefined;
            request.current += 1;
            window.removeEventListener(HASHTAGS_CHANGED_EVENT, changed);
        };
    }, [refresh, workspace]);

    const index = state.workspace === workspace ? state.index : emptyIndex;
    const projected = useMemo(() => projectNotes(notes, index), [notes, index, projectNotes]);

    return {
        notes: projected,
        loading: state.workspace !== workspace || !state.ready,
        error: state.workspace === workspace ? state.error : null,
        refresh,
    };
}
