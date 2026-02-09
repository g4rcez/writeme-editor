import { useEffect, useState, useMemo } from "react";
import { repositories, globalState, globalDispatch } from "../../store/global.store";
import { db } from "../../store/repositories/dexie/dexie-db";
import { Note } from "../../store/note";
import { Link, useNavigate } from "react-router-dom";
import { createColumns, Table } from "@g4rcez/components";
import { format } from "date-fns";
import { Search, Trash2, FileText, Hash, LinkIcon } from "lucide-react";

interface NoteWithTags extends Note {
  tagsList: string[];
  tagCount: number;
}

export default function NotesListPage() {
  const [notes, setNotes] = useState<NoteWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const cols = createColumns<NoteWithTags>((col) => {
    col.add("title", "Title", {
      Element: (props) => (
        <Link
          to={`/note/${props.row.id}`}
          className="transition-colors duration-300 ease-linear flex gap-1.5 items-center hover:underline text-primary hover:text-primary-hover"
        >
          <LinkIcon size={14} />
          {props.row.title}
        </Link>
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
          db.hashtags.toArray(),
        ]);

        // Group tags by filename
        const tagsMap = new Map<string, string[]>();
        allHashtags.forEach((h) => {
          if (!tagsMap.has(h.filename)) {
            tagsMap.set(h.filename, []);
          }
          tagsMap.get(h.filename)?.push(h.hashtag);
        });

        const notesWithTags = allNotes.map((note) => {
          // Key for tags is filename (path or title)
          const key = note.filePath || note.title;
          const tags = tagsMap.get(key) || [];
          return {
            ...note,
            tagsList: tags,
            tagCount: tags.length,
          };
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
        await globalDispatch.removeTab(tabToRemove.id);
      }
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
    <div className="flex-col p-6 mx-auto max-w-safe bg-background">
      <div className="flex justify-between items-center mb-6">
        <h1 className="flex gap-2 items-center text-2xl font-bold">
          <FileText className="w-6 h-6" />
          All Notes
        </h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search notes or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="py-2 pr-4 pl-9 w-full text-sm bg-transparent rounded-md border focus:ring-2 focus:outline-none border-input focus:ring-primary"
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
    </div>
  );
}
