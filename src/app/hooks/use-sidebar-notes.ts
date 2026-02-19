import { useEffect, useMemo, useState } from "react";
import { repositories } from "@/store/repositories";
import { Note } from "@/store/note";
import { useGlobalStore } from "@/store/global.store";
import { useLayoutContext } from "@/app/contexts/layout-context";
import { NoteWithTags } from "./use-note-list";

export function useSidebarNotes() {
  const [state] = useGlobalStore();
  const { state: layoutState } = useLayoutContext();
  const [innerNotes, setInnerNotes] = useState<NoteWithTags[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async (allNotes: Note[]) => {
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
      const notesWithTags = allNotes.map((note: Note): NoteWithTags => {
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
      console.error("Failed to load sidebar notes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(state.notes);
  }, [state.notes]);

  const filteredNotes = useMemo(() => {
    let result = innerNotes;
    const { activeView, searchQuery, activeActivity } = layoutState;
    if (activeActivity === "favorites") {
      result = result.filter((n) => n.favorite);
    } else if (activeActivity === "tags" && activeView.type === "tag") {
      result = result.filter((n) => n.tags.includes(activeView.id));
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
            result = result.filter(
              (n) => n.filePath && n.filePath.includes(activeView.id),
            );
          }
          break;
        case "tag":
          if (activeView.id) {
            result = result.filter(
              (n) =>
                n.tags.includes(activeView.id) ||
                n.tags.includes(activeView.id),
            );
          }
          break;
      }
    }
    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(lower) ||
          n.tags.some((t) => t.toLowerCase().includes(lower)) ||
          (n.url && n.url.toLowerCase().includes(lower)),
      );
    }

    // 3. Sort (Default: updated descending)
    return result.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }, [
    innerNotes,
    layoutState.activeView,
    layoutState.searchQuery,
    layoutState.activeActivity,
  ]);

  return {
    loading,
    notes: filteredNotes,
  };
}
