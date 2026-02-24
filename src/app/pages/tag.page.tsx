import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { createColumns, Table, Tag, TagProps } from "@g4rcez/components";
import { LinkIcon } from "@phosphor-icons/react/dist/csr/Link";
import { HashIcon } from "@phosphor-icons/react/dist/csr/Hash";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";

type TagNoteResult = Note & { occurrences: number };

const tagThemeMap: Record<
  Note["noteType"],
  { title: string; theme: TagProps["theme"] }
> = {
  "read-it-later": { theme: "info", title: "Read it later" },
  quick: { theme: "muted", title: "Quick note" },
  note: { theme: "primary", title: "Note" },
  template: { theme: "secondary", title: "Template" },
};

export default function TagPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<TagNoteResult[]>([]);
  const [state] = useGlobalStore();

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [allNotes] = await Promise.all([repositories.notes.getAll()]);

        const matchedNotes: TagNoteResult[] = [];

        // Regex to find word-bounded tag matches
        const regex = new RegExp(`#${id}\\b`, "gi");

        for (const note of allNotes) {
          const matches = note.content.match(regex);
          if (matches && matches.length > 0) {
            const copy = Object.assign(
              Object.create(Object.getPrototypeOf(note)),
              note,
            ) as TagNoteResult;
            copy.occurrences = matches.length;
            matchedNotes.push(copy);
          }
        }

        // Sort by occurrences descending
        matchedNotes.sort((a, b) => b.occurrences - a.occurrences);
        setNotes(matchedNotes);
      } catch (error) {
        console.error("Failed to load tag data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, state.notes]);

  const cols = createColumns<TagNoteResult>((col) => {
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
        <Tag
          className="rounded-xl"
          size="small"
          theme={tagThemeMap[props.value].theme}
        >
          {tagThemeMap[props.value].title}
        </Tag>
      ),
    });
    col.add("occurrences", "Occurrences", {
      Element: (props) => props.row.occurrences,
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
    <div className="relative flex-col py-6 mx-auto min-h-full max-w-safe">
      <div className="flex justify-between items-center mb-6">
        <h1 className="flex gap-2 items-center text-2xl font-bold">
          <HashIcon className="w-6 h-6 text-primary" />
          {id}
        </h1>
      </div>

      {notes.length === 0 ? (
        <div className="p-8 text-center border border-dashed rounded-lg border-border text-muted-foreground">
          <p>No notes found containing the tag #{id}</p>
        </div>
      ) : (
        <Table
          cols={cols}
          name="tag-notes"
          reference="id"
          useControl={false}
          rows={notes}
        />
      )}
    </div>
  );
}
