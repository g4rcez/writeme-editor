import {
  FilePlusCorner,
  FileTextIcon,
  LucideIcon,
  SearchIcon,
} from "lucide-react";
import { CommanderType, useGlobalStore } from "../../store/global.store";
import { Link } from "react-router-dom";

type Item = { title: string; Icon: LucideIcon; shortcut: string } & (
  | { action: Function }
  | { href: string }
);

const Section = (props: { title: string; items: Item[] }) => {
  return (
    <section className="mx-auto w-full max-w-lg">
      <header>
        <h3 className="text-lg font-medium tracking-wide text-primary">
          {props.title}
        </h3>
        <ul className="flex flex-col gap-2 mx-auto mt-2 ml-4 w-full">
          {props.items.map((x) => {
            const Render =
              typeof (x as any).action === "function" ? "button" : Link;
            return (
              <li
                key={`item-section-${props.title}-${x.title}`}
                className="flex gap-1 justify-between items-baseline w-full"
              >
                <Render
                  to={(x as any).href}
                  onClick={(x as any).action}
                  className="flex gap-2 items-baseline text-left hover:text-primary transition-colors duration-300 ease-in-out"
                >
                  <div className="flex items-center justify-center size-5 flex-1">
                    <x.Icon size={12} />
                  </div>
                  <p className="text-pretty whitespace-break-spaces max-w-md">
                    {x.title}
                  </p>
                </Render>
                <span className="proportional-nums w-4 text-center">
                  {x.shortcut}
                </span>
              </li>
            );
          })}
        </ul>
      </header>
    </section>
  );
};

export const DashboardPage = () => {
  const [state, dispatch] = useGlobalStore();

  const onSearch = () => dispatch.commander(true, CommanderType.Notes);

  const createNewNote = () =>
    dispatch.setCreateNoteDialog({ isOpen: true, type: "note" });

  return (
    <div className="flex flex-col gap-8 justify-center items-center mx-auto w-full h-full max-w-safe">
      <header className="space-y-2 text-center">
        <h2 className="text-7xl font-bold tracking-wide text-primary">
          WriteMe
        </h2>
      </header>
      <main className="flex flex-col gap-8 mx-auto w-full max-w-safe">
        <Section
          title="Quick actions"
          items={[
            {
              shortcut: "f",
              action: onSearch,
              Icon: SearchIcon,
              title: "Find file",
            },
            {
              shortcut: "n",
              title: "New file",
              Icon: FilePlusCorner,
              action: createNewNote,
            },
          ]}
        />
        <Section
          title="Recent files"
          items={state.notes.slice(0, 5).map((x, i) => ({
            title: x.title,
            Icon: FileTextIcon,
            href: `/note/${x.id}`,
            shortcut: i.toString(),
          }))}
        />
      </main>
    </div>
  );
};

export default DashboardPage;
