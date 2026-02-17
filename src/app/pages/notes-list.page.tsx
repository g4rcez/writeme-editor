import {
  Checkbox,
  createColumns,
  Input,
  Table,
  Tag,
  TagProps,
} from "@g4rcez/components";
import {
  LinkIcon,
  LogsIcon,
  Search,
  SearchIcon,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  globalDispatch,
  globalState,
} from "../../store/global.store";
import { repositories } from "../../store/repositories";
import { Note } from "../../store/note";

interface NoteWithTags extends Note {
  tagsList: string[];
  tagCount: number;
}

const tag: Record<
  Note["noteType"],
  { title: string; theme: TagProps["theme"] }
> = {
  "read-it-later": { theme: "info", title: "Read it later" },
  quick: { theme: "muted", title: "Quick note" },
  note: { theme: "primary", title: "Note" },
};

export default function NotesListPage() {
  const [notes, setNotes] = useState<NoteWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const cols = createColumns<NoteWithTags>((col) => {
    col.add(
      "id",
      <Checkbox
        checked={selectedIds.size === notes.length}
        onChange={selectAll}
      />,
      {
        thProps: { className: "w-12" },
        cellProps: { className: "w-12" },
        Element: (props) => (
          <Checkbox
            onClick={(e) => e.stopPropagation()}
            checked={selectedIds.has(props.row.id)}
            onChange={() => toggleSelection(props.row.id)}
          />
        ),
      },
    );
    col.add("title", "Title", {
      Element: (props) => (
        <Link
          to={`/note/${props.row.id}`}
          className="flex gap-1.5 items-baseline transition-colors duration-300 ease-linear hover:underline text-primary hover:text-primary-hover"
        >
          <LinkIcon className="min-w-4" size={12} />
          {props.row.title}
        </Link>
      ),
    });
    col.add("noteType", "Type", {
      Element: (props) => (
        <Tag className="rounded-xl" size="small" theme={tag[props.value].theme}>
          {tag[props.value].title}
        </Tag>
      ),
    });
    col.add("tagCount", "Hashtags", {
      Element: (props) => props.row.tagCount,
    });
    col.add("id", "Actions", {
      Element: (props) => (
        <button
          onClick={(e) => handleDelete(e, props.row.id)}
          className="p-2 text-red-500 rounded transition-colors hover:bg-red-500/10"
          title="Delete note"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    });
  });

  useEffect(() => {
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

        const notesWithTags = allNotes.map((note): NoteWithTags => {
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

    loadData();
  }, []);

  const filteredNotes = useMemo(() => {
    if (!search) return notes;
    const lower = search.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(lower) ||
        n.tagsList.some((t) => t.toLowerCase().includes(lower)),
    );
  }, [notes, search]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this note?")) {
      await repositories.notes.delete(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      const tabs = globalState().tabs;
      const tabToRemove = tabs.find((t) => t.noteId === id);
      if (tabToRemove) {
        globalDispatch.removeTab(tabToRemove.id);
      }
      // Also remove from selection if it was selected
      if (selectedIds.has(id)) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
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
      }
      setNotes((prev) => prev.filter((n) => !selectedIds.has(n.id)));
      setSelectedIds(new Set());
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center w-full h-full">
        Loading notes...
      </div>
    );
  }

  return (
    <div className="relative flex-col py-6 mx-auto min-h-full max-w-safe bg-background">
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-4 items-center">
          <h1 className="flex gap-2 items-center text-2xl font-bold">
            <LogsIcon className="w-6 h-6" />
            All Notes
          </h1>
        </div>
        <div className="relative w-64">
          <Input
            hiddenLabel
            type="text"
            value={search}
            left={<SearchIcon size={16} />}
            title="Search notes or tags..."
            placeholder="Search notes or tags..."
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <Table
        cols={cols}
        name="notes"
        reference="id"
        useControl={false}
        rows={filteredNotes}
      />

      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 z-50 duration-200 -translate-x-1/2 animate-in slide-in-from-bottom-4 fade-in">
          <div className="flex gap-4 items-center py-3 px-6 rounded-xl border shadow-xl border-border bg-card text-card-foreground">
            <span className="font-medium">{selectedIds.size} selected</span>
            <div className="w-px h-4 bg-border" />
            <button
              onClick={handleBatchDelete}
              className="flex gap-2 items-center text-sm font-medium transition-colors text-destructive hover:text-destructive/80"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <button
              onClick={deselectAll}
              className="p-1 ml-2 rounded-full transition-colors hover:bg-muted/50"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
