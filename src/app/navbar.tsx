import { Link } from "brouther";
import { useEffect, useState } from "react";
import { Layout } from "./components/layout";
import { links } from "./router";
import { useGlobalStore } from "../store/global.store";
import { Note } from "../store/note";

export const Navbar = () => {
  const [state, dispatch] = useGlobalStore();
  const [editingTitle, setEditingTitle] = useState<string | null>(null);

  // Reset local state when note changes externally (e.g., switching notes)
  useEffect(() => {
    setEditingTitle(null);
  }, [state.note?.id]);

  return (
    <header className="sticky top-0 z-10 w-full h-10 backdrop-blur-sm bg-card-background/80">
      <Layout className="flex justify-between items-center h-10">
        <h1 className="text-lg font-semibold tracking-tight">
          <Link
            href={links.root}
            className="transition-opacity hover:opacity-80"
          >
            writeme
          </Link>
        </h1>
        {state.note && (
          <input
            placeholder="Untitled"
            value={editingTitle ?? state.note.title}
            className="flex-1 px-2 mx-4 max-w-xs text-sm text-center bg-transparent rounded border outline-none truncate border-card-border"
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={() => {
              if (editingTitle !== null && editingTitle !== state.note.title) {
                const note = Note.parse(state.note);
                note.title = editingTitle;
                dispatch.note(note);
              }
              setEditingTitle(null);
            }}
          />
        )}
        <nav>
          <ul className="flex flex-row gap-6 items-center text-sm">
            <li>
              <Link
                href={links.examples}
                className="opacity-70 transition-opacity hover:opacity-100"
              >
                examples
              </Link>
            </li>
            <li>
              <Link
                href={links.about}
                className="opacity-70 transition-opacity hover:opacity-100"
              >
                about
              </Link>
            </li>
          </ul>
        </nav>
      </Layout>
    </header>
  );
};
