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
                className="flex gap-1 justify-between items-center w-full"
              >
                <Render
                  to={(x as any).href}
                  onClick={(x as any).action}
                  className="flex gap-2 items-center text-left"
                >
                  <x.Icon size={12} />
                  {x.title}
                </Render>
                {x.shortcut}
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
      {/* <div className="grid grid-cols-1 gap-4 w-full max-w-2xl sm:grid-cols-2"> */}
      {/*   <button */}
      {/*     onClick={createNewNote} */}
      {/*     className="flex flex-col gap-4 justify-center items-center p-8 h-48 rounded-xl border shadow transition-all hover:shadow-md border-border bg-card text-card-foreground group hover:bg-muted/50 hover:scale-[1.02]" */}
      {/*   > */}
      {/*     <div className="p-4 rounded-full transition-colors bg-primary/10 text-primary group-hover:bg-primary/20"> */}
      {/*       <Plus className="w-8 h-8" /> */}
      {/*     </div> */}
      {/*     <div className="text-center"> */}
      {/*       <h3 className="text-lg font-semibold">Create New Note</h3> */}
      {/*       <p className="mt-1 text-sm text-muted-foreground"> */}
      {/*         Start writing a fresh idea */}
      {/*       </p> */}
      {/*     </div> */}
      {/*   </button> */}
      {/**/}
      {/*   <Link */}
      {/*     to="/read-it-later" */}
      {/*     className="flex flex-col gap-4 justify-center items-center p-8 h-48 rounded-xl border shadow transition-all hover:shadow-md border-border bg-card text-card-foreground group hover:bg-muted/50 hover:scale-[1.02]" */}
      {/*   > */}
      {/*     <div className="p-4 rounded-full transition-colors bg-secondary text-secondary-foreground group-hover:bg-secondary/80"> */}
      {/*       <BookmarkCheckIcon className="w-8 h-8" /> */}
      {/*     </div> */}
      {/*     <div className="text-center"> */}
      {/*       <h3 className="text-lg font-semibold">Read It Later</h3> */}
      {/*       <p className="mt-1 text-sm text-muted-foreground"> */}
      {/*         Access your saved items */}
      {/*       </p> */}
      {/*     </div> */}
      {/*   </Link> */}
      {/* </div> */}
    </div>
  );
};

export default DashboardPage;
