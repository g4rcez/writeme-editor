import { Link } from "brouther";
import { links } from "./router";
import { useGlobalStore } from "../store/global.store";
import { Note } from "../store/note";

export const Navbar = () => {
  const [state, dispatch] = useGlobalStore();
  return (
    <header className="sticky top-0 w-full h-12 bg-card-background">
      <nav className="container flex justify-between items-center px-8 mx-auto w-full max-w-5xl h-12 lg:px-0">
        <h1>
          <Link href={links.root}>writeme</Link>
        </h1>
        <div className="flex items-center">
          <input
            value={state.note.title}
            onChange={(e) => {
              const note = Note.parse(state.note);
              note.title = e.target.value;
              dispatch.note(note);
            }}
            placeholder="Note title..."
            className="p-1 px-2 bg-transparent rounded border border-card-border"
          />
        </div>
        <ul className="flex flex-row gap-8 items-center">
          <li>
            <Link href={links.examples}>examples</Link>
          </li>
          <li>
            <Link href={links.about}>about</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
};
