import { useEffect, useMemo, useState } from "react";
import type { Note } from "@/store/note";
import { useLayoutStore } from "@/app/contexts/layout-context";
import { filterNotesByQuery } from "@/lib/note-search";
import { useGlobalStore } from "@/store/global.store";
import { repositories } from "@/store/repositories";
import type { NoteWithTags } from "./use-note-list";

type SortBy = "updatedAt" | "createdAt" | "alphabetical";

export function useSidebarNotes(options?: { sortBy?: SortBy }) {
    const sortBy = options?.sortBy ?? "createdAt";
    const [state] = useGlobalStore();
    const [layoutState] = useLayoutStore((s) => ({
        activeView: s.activeView,
        searchQuery: s.searchQuery,
        activeActivity: s.activeActivity,
    }));
    const [innerNotes, setInnerNotes] = useState<NoteWithTags[]>([]);
    const [loading, setLoading] = useState(true);

    const noteMetaFingerprint = useMemo(
        () =>
            state.notes
                .map((n) =>
                    [
                        n.id,
                        n.title,
                        n.updatedAt.getTime(),
                        String(n.favorite),
                        n.noteType,
                        n.description,
                        n.url,
                        n.filePath,
                        n.tags.join(","),
                    ].join("|"),
                )
                .join("|"),
        [state.notes],
    );

    const loadData = async (allNotes: Note[]) => {
        if (innerNotes.length === 0) {
            setLoading(true);
        }
        try {
            const allHashtags = await repositories.hashtags.getAll();
            const tagsMap = new Map<string, string[]>();
            allHashtags.forEach((h) => {
                if (!tagsMap.has(h.filename)) {
                    tagsMap.set(h.filename, []);
                }
                tagsMap.get(h.filename)?.push(h.hashtag);
            });
            const notesWithTags = allNotes.map((note: Note): NoteWithTags => {
                const key = note.filePath || note.title;
                const tags = Array.from(new Set([...note.tags, ...(tagsMap.get(key) ?? [])]));
                return {
                    ...note,
                    tags: tags,
                    tagCount: tags.length,
                } as NoteWithTags;
            });
            setInnerNotes(notesWithTags);
        } catch (error) {
            console.error("Failed to load sidebar notes:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData(state.notes);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [noteMetaFingerprint]);

    const { activeView, searchQuery, activeActivity } = layoutState;
    const filteredNotes = useMemo(() => {
        let result = innerNotes;
        if (activeActivity === "favorites") {
            result = result.filter((n) => n.favorite && n.noteType !== "template");
        } else if (activeActivity === "tags" && activeView.type === "tag") {
            result = result.filter((n) => n.tags.includes(activeView.id) && n.noteType !== "template");
        } else {
            switch (activeView.type) {
                case "all":
                    result = result.filter((n) => n.noteType === "note");
                    break;
                case "quick":
                    result = result.filter((n) => n.noteType === "quick");
                    break;
                case "read-it-later":
                    result = result.filter((n) => n.noteType === "read-it-later");
                    break;
                case "favorites":
                    result = result.filter((n) => n.favorite);
                    break;
                case "trash":
                    result = [];
                    break;
                case "folder":
                    if (activeView.id) {
                        result = result.filter((n) => n.filePath && n.filePath.includes(activeView.id));
                    }
                    break;
                case "tag":
                    if (activeView.id) {
                        result = result.filter((n) => n.tags.includes(activeView.id));
                    }
                    break;
                default:
                    break;
            }
        }
        if (searchQuery.trim()) {
            // Search results are already ordered by fzf compatibility.
            return filterNotesByQuery(result, searchQuery);
        }

        if (sortBy === "alphabetical") {
            return [...result].sort((a, b) => a.title.localeCompare(b.title));
        }
        if (sortBy === "createdAt") {
            return [...result].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return [...result].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }, [innerNotes, activeView, searchQuery, activeActivity, sortBy]);

    return {
        loading,
        notes: filteredNotes,
    };
}
