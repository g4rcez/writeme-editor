import { useDeferredValue, useMemo } from "react";
import type { Note } from "@/store/note";
import { useLayoutStore } from "@/app/contexts/layout-context";
import { filterNotesByQuery } from "@/lib/note-search";
import { isReadItLaterNote } from "@/lib/read-it-later-library";
import { useGlobalStore } from "@/store/global.store";
import { useNotesWithTags } from "./use-notes-with-tags";

type SortBy = "updatedAt" | "createdAt" | "alphabetical";

export function useSidebarNotes(options?: { sortBy?: SortBy }) {
    const sortBy = options?.sortBy ?? "createdAt";
    const [state] = useGlobalStore((state) => ({ notes: state.notes, directory: state.directory }));
    const [layoutState] = useLayoutStore((s) => ({
        activeView: s.activeView,
        searchQuery: s.searchQuery,
        activeActivity: s.activeActivity,
    }));
    const uniqueNotes = useMemo(() => {
        const notes = new Map<string, Note>();
        for (const note of state.notes) {
            const existing = notes.get(note.id);
            if (!existing || note.updatedAt > existing.updatedAt) notes.set(note.id, note);
        }
        return [...notes.values()];
    }, [state.notes]);
    const { notes: innerNotes, loading, error } = useNotesWithTags(uniqueNotes, state.directory);

    const { activeView, activeActivity } = layoutState;
    const searchQuery = useDeferredValue(layoutState.searchQuery);
    const filteredNotes = useMemo(() => {
        let result = innerNotes;
        if (activeActivity === "read-it-later") {
            result = result.filter((note) => !note.deletedAt && isReadItLaterNote(note));
        } else if (activeActivity === "favorites") {
            result = result.filter((n) => n.favorite && n.noteType !== "template");
        } else if (activeActivity === "tags" && activeView.type === "tag") {
            result = result.filter((n) => n.tags.includes(activeView.id) && n.noteType !== "template");
        } else {
            switch (activeView.type) {
                case "all":
                    result = result.filter((n) => n.noteType === "note" || n.noteType === "meeting-note" || n.noteType === "freehand" || n.noteType === "task");
                    break;
                case "quick":
                    result = result.filter((n) => n.noteType === "quick");
                    break;
                case "read-it-later":
                    result = result.filter((note) => !note.deletedAt && isReadItLaterNote(note));
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
        error,
        notes: filteredNotes,
    };
}
