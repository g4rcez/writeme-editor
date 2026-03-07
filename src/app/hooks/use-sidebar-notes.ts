import { useLayoutStore } from "@/app/contexts/layout-context";
import { useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";
import { useEffect, useMemo, useState } from "react";
import { type NoteWithTags } from "./use-note-list";

type SortBy = "updatedAt" | "createdAt" | "alphabetical";

export function useSidebarNotes(options?: { sortBy?: SortBy }) {
  const sortBy = options?.sortBy ?? "updatedAt";
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
        .map(
          (n) =>
            n.id +
            n.title +
            n.updatedAt.getTime() +
            String(n.favorite) +
            n.noteType,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteMetaFingerprint]);

  const filteredNotes = useMemo(() => {
    let result = innerNotes;
    const { activeView, searchQuery, activeActivity } = layoutState;
    if (activeActivity === "favorites") {
      result = result.filter((n) => n.favorite && n.noteType !== "template");
    } else if (activeActivity === "tags" && activeView.type === "tag") {
      result = result.filter(
        (n) => n.tags.includes(activeView.id) && n.noteType !== "template",
      );
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
            result = result.filter((n) => n.tags.includes(activeView.id));
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

    if (sortBy === "alphabetical") {
      return [...result].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortBy === "createdAt") {
      return [...result].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    }
    return [...result].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
  }, [
    innerNotes,
    layoutState.activeView,
    layoutState.searchQuery,
    layoutState.activeActivity,
    sortBy,
  ]);

  return {
    loading,
    notes: filteredNotes,
  };
}
