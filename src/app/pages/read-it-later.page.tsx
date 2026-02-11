import { createColumns, Table } from "@g4rcez/components";
import { format } from "date-fns";
import { Bookmark, ExternalLink, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { repositories } from "../../store/global.store";
import { Note } from "../../store/note";

export default function ReadItLaterPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const cols = createColumns<Note>((col) => {
    col.add("title", "Title", {
      Element: (props) => (
        <Link
          to={`/note/${props.row.id}`}
          className="transition-colors duration-300 ease-linear flex gap-1.5 items-center hover:underline text-primary hover:text-primary-hover"
        >
          <Bookmark size={14} />
          {props.row.title}
        </Link>
      ),
    });
    col.add("url", "URL", {
      Element: (props) => (
         props.row.url ? (
          <a
            href={props.row.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-1 items-center text-blue-500 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} />
            Link
          </a>
        ) : <span className="text-muted-foreground">-</span>
      ),
    });
    col.add("createdAt", "Created At", {
      Element: (props) => (
        <span>{format(props.row.createdAt, "yyyy-MM-dd HH:mm")}</span>
      ),
    });
    col.add("id", "Actions", {
      Element: (props) => (
        <button
          title="Delete note"
          onClick={(e) => handleDelete(e, props.row.id)}
          className="p-2 text-red-500 rounded transition-colors hover:bg-red-500/10"
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
        const allNotes = await repositories.notes.getAll();
        const readItLaterNotes = allNotes.filter(n => n.noteType === "read-it-later");
        setNotes(readItLaterNotes);
      } catch (error) {
        console.error("Failed to load read-it-later notes:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredNotes = useMemo(() => {
    let result = notes;
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(lower) ||
          (n.url && n.url.toLowerCase().includes(lower))
      );
    }
    // Implement sort by date desc
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [notes, search]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this note?")) {
      await repositories.notes.delete(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center w-full h-full">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex-col p-6 mx-auto max-w-safe bg-background">
      <div className="flex justify-between items-center mb-6">
        <h1 className="flex gap-2 items-center text-2xl font-bold">
          <Bookmark className="w-6 h-6" />
          Read It Later
        </h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="py-2 pr-4 pl-9 w-full text-sm bg-transparent rounded-md border focus:ring-2 focus:outline-none border-input focus:ring-primary"
          />
        </div>
      </div>
      <Table
        cols={cols}
        reference="id"
        useControl={false}
        name="read-it-later"
        rows={filteredNotes}
      />
    </div>
  );
}
