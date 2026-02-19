import {
  FilePlusCorner,
  FileTextIcon,
  LucideIcon,
  SearchIcon,
} from "lucide-react";
import { CommanderType, useGlobalStore } from "../../store/global.store";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { SettingsService } from "../../store/settings";
import { NoteWithTags } from "../hooks/use-note-list";

type Item = { title: string; Icon: LucideIcon; shortcut: string } & (
  | { href: string }
  | { action: Function }
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
                  className="flex gap-2 items-baseline text-left transition-colors duration-300 ease-in-out hover:text-primary"
                >
                  <div className="flex flex-1 justify-center items-center size-5">
                    <x.Icon size={12} />
                  </div>
                  <p className="max-w-md text-pretty whitespace-break-spaces">
                    {x.title}
                  </p>
                </Render>
                <span className="w-4 proportional-nums text-center">
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

export default function DashboardPage() {
  const [state, dispatch] = useGlobalStore();
  const [cwd, setCwd] = useState<string | null>(null);

  useEffect(() => {
    const settings = SettingsService.get();
    if (settings.directory) {
      setCwd(settings.directory);
    } else {
      // Fallback to home if not set, similar to DirectoryBrowserDialog
      if (window.electronAPI) {
        window.electronAPI.env.getHome().then(setCwd);
      }
    }
  }, []);

  const onSearch = () => dispatch.commander(true, CommanderType.Notes);

  const createNewNote = () =>
    dispatch.setCreateNoteDialog({ isOpen: true, type: "note" });

  return (
    <div className="flex flex-col gap-8 justify-center items-center mx-auto w-full h-full max-w-safe">
      <header className="space-y-2 text-center">
        <h2 className="text-7xl font-bold tracking-wide text-primary">
          WriteMe
        </h2>
        {cwd && (
          <p className="font-mono text-sm text-muted-foreground">{cwd}</p>
        )}
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
          items={state.notes.slice(0, 5).map((x: NoteWithTags, i: number) => ({
            title: x.title,
            Icon: FileTextIcon,
            href: `/note/${x.id}`,
            shortcut: i.toString(),
          }))}
        />
      </main>
    </div>
  );
}
