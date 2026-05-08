import React, { useEffect, useMemo, useState } from "react";
import { repositories } from "@/store/repositories";
import { Note } from "@/store/note";
import { useGlobalStore } from "@/store/global.store";
import { Modal } from "@g4rcez/components";
import { notificationRef } from "@/app/notification-ref";

export type NoteWithTags = Note & {
  tagCount: number;
};

type UseNoteListOptions = {
  noteType?: Note["noteType"];
  onDelete?: (id: string) => void;
};

export function useNoteList(options: UseNoteListOptions = {}) {
  const [state, dispatch] = useGlobalStore();
  const [innerNotes, setInnerNotes] = useState<NoteWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadData = async (newNotes: Note[]) => {
    setLoading(true);
    try {
      const allHashtags = await repositories.hashtags.getAll();
      const tagsMap = new Map<string, string[]>();
      allHashtags.forEach((h) => {
        if (!tagsMap.has(h.filename)) {
          tagsMap.set(h.filename, []);
        }
        tagsMap.get(h.filename)?.push(h.hashtag);
      });

      const filteredByProp = options.noteType
        ? newNotes.filter((n: Note) => n.noteType === options.noteType)
        : newNotes.filter((n: Note) => n.noteType !== "template");
      const notesWithTags = filteredByProp.map((note: Note): NoteWithTags => {
        const key = note.filePath || note.title;
        const tags = tagsMap.get(key) || [];
        return {
          ...note,
          tags: tags,
          tagCount: tags.length,
        } as NoteWithTags;
      });
      setInnerNotes(notesWithTags);
    } catch (error) {
      console.error("Failed to load notes list:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(state.notes);
  }, [state.notes, options.noteType]);

  const filteredNotes = useMemo(() => {
    let result = innerNotes;
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (n: NoteWithTags) =>
          n.title.toLowerCase().includes(lower) ||
          n.tags.some((t) => t.toLowerCase().includes(lower)) ||
          (n.url && n.url.toLowerCase().includes(lower)),
      );
    }
    if (options.noteType === "read-it-later") {
      return result.sort(
        (a: NoteWithTags, b: NoteWithTags) =>
          b.createdAt.getTime() - a.createdAt.getTime(),
      );
    }
    return result;
  }, [innerNotes, search, options.noteType]);

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

  const selectAll = () =>
    setSelectedIds(new Set(filteredNotes.map((n: NoteWithTags) => n.id)));

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
        React.createElement(
          "span",
          null,
          note ? `"${note.title}" moved to Trash.` : "Note moved to Trash.",
        ),
        React.createElement(
          "button",
          {
            type: "button",
            className:
              "shrink-0 font-semibold underline underline-offset-2 hover:opacity-70",
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
      title: "Delete Notes",
      description: `Are you sure you want to delete ${selectedIds.size} notes?`,
      confirm: {
        text: "Delete",
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
    refresh: loadData,
  };
}
