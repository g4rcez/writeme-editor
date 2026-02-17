import { useEffect, useMemo, useState } from "react";
import { repositories } from "../../store/repositories";
import { Note } from "../../store/note";
import { globalDispatch, globalState } from "../../store/global.store";

export interface NoteWithTags extends Note {
  tagsList: string[];
  tagCount: number;
}

interface UseNoteListOptions {
  noteType?: Note["noteType"];
  onDelete?: (id: string) => void;
}

export function useNoteList(options: UseNoteListOptions = {}) {
  const [notes, setNotes] = useState<NoteWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadData = async () => {
    setLoading(true);
    try {
      const [allNotes, allHashtags] = await Promise.all([
        repositories.notes.getAll(),
        repositories.hashtags.getAll(),
      ]);

      const tagsMap = new Map<string, string[]>();
      allHashtags.forEach((h) => {
        if (!tagsMap.has(h.filename)) {
          tagsMap.set(h.filename, []);
        }
        tagsMap.get(h.filename)?.push(h.hashtag);
      });

      const filteredByProp = options.noteType 
        ? allNotes.filter(n => n.noteType === options.noteType)
        : allNotes;

      const notesWithTags = filteredByProp.map((note): NoteWithTags => {
        const key = note.filePath || note.title;
        const tags = tagsMap.get(key) || [];
        return {
          ...note,
          tagsList: tags,
          tagCount: tags.length,
        } as NoteWithTags;
      });
      setNotes(notesWithTags);
    } catch (error) {
      console.error("Failed to load notes list:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [options.noteType]);

  const filteredNotes = useMemo(() => {
    let result = notes;
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(lower) ||
          n.tagsList.some((t) => t.toLowerCase().includes(lower)) ||
          (n.url && n.url.toLowerCase().includes(lower))
      );
    }
    
    if (options.noteType === "read-it-later") {
        return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    
    return result;
  }, [notes, search, options.noteType]);

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
    setSelectedIds(new Set(filteredNotes.map((n) => n.id)));

  const deselectAll = () => setSelectedIds(new Set());

  const handleDelete = async (e: React.MouseEvent | undefined, id: string) => {
    e?.stopPropagation();
    if (confirm("Are you sure you want to delete this note?")) {
      await repositories.notes.delete(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      const tabs = globalState().tabs;
      const tabToRemove = tabs.find((t) => t.noteId === id);
      if (tabToRemove) {
        globalDispatch.removeTab(tabToRemove.id);
      }
      if (selectedIds.has(id)) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
      options.onDelete?.(id);
    }
  };

  const handleBatchDelete = async () => {
    if (confirm(`Are you sure you want to delete ${selectedIds.size} notes?`)) {
      const tabs = globalState().tabs;
      for (const id of selectedIds) {
        await repositories.notes.delete(id);
        const tabToRemove = tabs.find((t) => t.noteId === id);
        if (tabToRemove) {
          await globalDispatch.removeTab(tabToRemove.id);
        }
        options.onDelete?.(id);
      }
      setNotes((prev) => prev.filter((n) => !selectedIds.has(n.id)));
      setSelectedIds(new Set());
    }
  };

  return {
    notes,
    loading,
    search,
    setSearch,
    filteredNotes,
    selectedIds,
    toggleSelection,
    selectAll,
    deselectAll,
    handleDelete,
    handleBatchDelete,
    refresh: loadData
  };
}
