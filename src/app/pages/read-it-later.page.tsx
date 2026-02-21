import { createColumns, Input, Table } from "@g4rcez/components";
import { format } from "date-fns";
import { BookmarkIcon } from "@phosphor-icons/react/dist/csr/Bookmark";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { Link } from "react-router-dom";
import { useNoteList, NoteWithTags } from "../hooks/use-note-list";

export default function ReadItLaterPage() {
  const { loading, search, setSearch, filteredNotes, handleDelete } =
    useNoteList({ noteType: "read-it-later" });

  const cols = createColumns<NoteWithTags>((col) => {
    col.add("title", "Title", {
      Element: (props) => (
        <Link
          to={`/note/${props.row.id}`}
          className="flex gap-1.5 items-center font-medium transition-colors duration-300 ease-linear hover:underline text-primary hover:text-primary-hover"
        >
          {props.row.favicon ? (
            <img
              src={props.row.favicon}
              alt="Favicon"
              className="object-contain rounded-sm size-4"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span className="block size-4 bg-disabled" />
          )}
          {props.row.title}
        </Link>
      ),
    });
    col.add("description", "Description", {
      Element: (props) => (
        <span
          className="block text-sm text-muted-foreground truncate max-w-[300px]"
          title={props.row.description || ""}
        >
          {props.row.description || "-"}
        </span>
      ),
    });
    col.add("url", "URL", {
      Element: (props) => {
        if (!props.value) return "-";
        const origin = new URL(props.value).host;
        return (
          <a
            target="_blank"
            href={props.row.url}
            rel="noopener noreferrer"
            className="flex gap-1 items-center text-blue-500 hover:underline"
          >
            <ArrowSquareOutIcon size={12} />
            {origin}
          </a>
        );
      },
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
          <TrashIcon className="w-4 h-4" />
        </button>
      ),
    });
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center w-full h-full">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex-col py-6 mx-auto max-w-safe bg-background">
      <div className="flex justify-between items-center mb-6">
        <h1 className="flex gap-2 items-center text-2xl font-bold">
          <BookmarkIcon className="w-6 h-6" />
          Read It Later
        </h1>
        <div className="flex justify-between items-center">
          <Input
            required
            type="text"
            value={search}
            placeholder="Search..."
            onChange={(e) => setSearch(e.target.value)}
            left={<MagnifyingGlassIcon size={16} className="text-muted-foreground" />}
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
