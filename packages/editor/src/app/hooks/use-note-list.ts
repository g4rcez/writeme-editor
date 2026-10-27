import { Modal } from "@g4rcez/components";
import React, { useDeferredValue, useMemo, useState } from "react";
import type { Note } from "@/store/note";
import { notificationRef } from "@/app/notification-ref";
import { filterNotesByQuery } from "@/lib/note-search";
import { useGlobalStore } from "@/store/global.store";

import { useNotesWithTags, type NoteWithTags } from "./use-notes-with-tags";

export type { NoteWithTags } from "./use-notes-with-tags";

type UseNoteListOptions = {
    noteType?: Note["noteType"];
    onDelete?: (id: string) => void;
};

export function useNoteList(options: UseNoteListOptions = {}) {
    const [state, dispatch] = useGlobalStore((state) => ({ notes: state.notes, directory: state.directory }));
    const { notes, loading, error, refresh } = useNotesWithTags(state.notes, state.directory);
    const innerNotes = useMemo(() => options.noteType
        ? notes.filter((note) => note.noteType === options.noteType)
        : notes.filter((note) => note.noteType !== "template"), [notes, options.noteType]);
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const filteredNotes = useMemo(() => {
        if (deferredSearch.trim()) {
            // Search results are already ordered by fzf compatibility.
            return filterNotesByQuery(innerNotes, deferredSearch);
        }

        const result = innerNotes;
        if (options.noteType === "read-it-later") {
            return [...result].sort(
                (a: NoteWithTags, b: NoteWithTags) => b.createdAt.getTime() - a.createdAt.getTime(),
            );
        }
        return result;
    }, [innerNotes, deferredSearch, options.noteType]);

    const toggleSelection = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const selectAll = () => setSelectedIds(new Set(filteredNotes.map((n: NoteWithTags) => n.id)));

    const deselectAll = () => setSelectedIds(new Set());

    const handleDelete = async (e: React.MouseEvent | undefined, id: string) => {
        e?.stopPropagation();
        const note = innerNotes.find((n) => n.id === id);
        await dispatch.deleteNote(id);
        if (selectedIds.has(id)) {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
        options.onDelete?.(id);
        const notify = notificationRef.current;
        if (notify) {
            const closeRef = { current: () => {} };
            const content = React.createElement(
                "div",
                { className: "flex items-center gap-2" },
                React.createElement("span", null, note ? `"${note.title}" moved to Trash.` : "Note moved to Trash."),
                React.createElement(
                    "button",
                    {
                        type: "button",
                        className: "shrink-0 font-semibold underline underline-offset-2 hover:opacity-70",
                        onClick: () => {
                            closeRef.current();
                            dispatch.restoreNote(id);
                        },
                    },
                    "Undo",
                ),
            );
            const { close } = notify(content, {
                theme: "info",
                closable: true,
                id: `trash:${id}`,
                timeout: 8000,
            });
            closeRef.current = close;
        }
    };

    const handleBatchDelete = async () => {
        const confirmed = await Modal.confirm({
            title: `Move ${selectedIds.size} ${selectedIds.size === 1 ? "note" : "notes"} to Trash?`,
            description: "You can restore them from Trash.",
            confirm: {
                text: "Move to Trash",
                theme: "danger",
            },
        });

        if (confirmed) {
            for (const id of selectedIds) {
                await dispatch.deleteNote(id);
                options.onDelete?.(id);
            }
            setSelectedIds(new Set());
        }
    };

    return {
        search,
        loading,
        selectAll,
        setSearch,
        deselectAll,
        selectedIds,
        handleDelete,
        filteredNotes,
        toggleSelection,
        handleBatchDelete,
        notes: innerNotes,
        refresh,
        error,
    };
}
