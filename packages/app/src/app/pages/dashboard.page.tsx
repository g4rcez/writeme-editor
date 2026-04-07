import { Dates } from "@/lib/dates";
import { tildaDir } from "@/lib/file-utils";
import { CommanderType, useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { Tag } from "@g4rcez/components";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { FilePlusIcon } from "@phosphor-icons/react/dist/csr/FilePlus";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { TagIcon } from "@phosphor-icons/react/dist/csr/Tag";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const item = { hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1 } };

const ActionCard = ({
  title,
  icon: Icon,
  onClick,
  shortcut,
}: {
  icon: any;
  title: string;
  shortcut: string;
  onClick: () => void;
}) => (
  <motion.button
    variants={item}
    onClick={onClick}
    className="flex relative flex-col items-start p-6 text-left rounded-2xl border transition-all duration-300 hover:shadow-2xl group bg-card-background border-card-border hover:border-primary/50 hover:shadow-primary/5"
  >
    <div className="p-3 mb-4 rounded-xl transition-transform duration-300 group-hover:scale-110 bg-primary/10 text-primary">
      <Icon size={24} strokeWidth={1.5} />
    </div>
    <h3 className="mb-1 text-lg font-semibold transition-colors group-hover:text-primary">
      {title}
    </h3>
    <div className="flex justify-between items-center mt-auto w-full">
      <span className="text-xs text-muted-foreground">Quick Action</span>
      <kbd className="py-1 px-2 font-mono uppercase rounded bg-muted text-[10px] text-muted-foreground">
        {shortcut}
      </kbd>
    </div>
  </motion.button>
);

const RecentNoteCard = ({ note }: { note: Note }) => {
  return (
    <motion.div variants={item}>
      <Link
        to={`/note/${note.id}`}
        className="flex gap-2 items-center p-4 rounded-xl border border-transparent transition-all duration-200 group hover:bg-muted/30 hover:border-border/50"
      >
        <div className="p-2 rounded-lg transition-colors bg-primary/5 text-disabled group-hover:bg-primary/10 group-hover:text-primary">
          <FileTextIcon size={32} />
        </div>
        <div className="flex-1 mr-4 min-w-0">
          <h4 className="transition-colors truncate group-hover:text-primary">
            {note.title || "Untitled"}
          </h4>
          <div className="flex gap-3 items-center mt-1 text-foreground/70">
            <span className="flex gap-1 items-center text-sm">
              {Dates.yearMonthDay(new Date(note.updatedAt))}
            </span>
            {note.tags.length > 0 && (
              <span className="flex gap-1 items-center text-xs">
                <TagIcon size={12} />
                {note.tags[0]}
              </span>
            )}
          </div>
        </div>
        <ArrowRightIcon
          size={16}
          className="opacity-0 transition-all -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 text-muted-foreground"
        />
      </Link>
    </motion.div>
  );
};

export default function DashboardPage() {
  const [state, dispatch] = useGlobalStore();
  const [cwd, setCwd] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    if (state.directory) {
      window.electronAPI.env.getHome().then((home) => {
        setCwd(tildaDir(home, state.directory ?? home));
      });
    } else if (window.electronAPI)
      window.electronAPI.env.getHome().then(setCwd);
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, [state.directory]);

  const onSearch = () => dispatch.commander(true, CommanderType.Notes);

  const createNewNote = () =>
    dispatch.setCreateNoteDialog({ isOpen: true, type: "note" });

  const favorites = state.notes.filter((n: Note) => n.favorite).slice(0, 3);
  const recent = state.notes.slice(0, 6);

  return (
    <div className="flex flex-col min-h-full bg-background selection:bg-primary/20">
      <main className="flex-1 py-12 px-6 mx-auto w-full max-w-6xl">
        <motion.header
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: -20 }}
          className="flex justify-between items-end mb-16"
        >
          <div>
            <h1 className="mb-2 text-4xl font-bold tracking-tight">
              {greeting}
            </h1>
            <p className="max-w-md text-lg text-foreground/70">
              Your digital garden is ready for today's thoughts.
            </p>
          </div>
          {cwd && (
            <div>
              <p className="text-xs font-bold text-right text-muted-foreground">
                Workspace
              </p>
              <p className="text-xs text-right">{cwd}</p>
            </div>
          )}
        </motion.header>
        <motion.div
          animate="show"
          initial="hidden"
          variants={container}
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
        >
          <div className="space-y-10 lg:col-span-2">
            <section>
              <div className="flex gap-2 items-center mb-6">
                <div className="w-0.5 h-4 rounded-full bg-primary" />
                <h2 className="text-lg font-bold tracking-widest uppercase">
                  Quick Actions
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ActionCard
                  title="New Document"
                  icon={FilePlusIcon}
                  shortcut="⌘ N"
                  onClick={createNewNote}
                />
                <ActionCard
                  title="Quick Search"
                  icon={MagnifyingGlassIcon}
                  shortcut="⌘ K"
                  onClick={onSearch}
                />
              </div>
            </section>
            <section>
              <div className="flex justify-between items-center mb-6">
                <div className="flex gap-2 items-center">
                  <div className="w-0.5 h-4 rounded-full bg-primary" />
                  <h2 className="text-lg font-bold tracking-widest uppercase">
                    Recent Documents
                  </h2>
                </div>
                <Link
                  to="/notes"
                  className="flex gap-1 items-center text-xs hover:underline text-primary group"
                >
                  View all
                  <ArrowRightIcon
                    size={12}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {recent.map((note: Note) => (
                  <RecentNoteCard key={note.id} note={note} />
                ))}
                {recent.length === 0 && (
                  <div className="col-span-full py-12 text-center rounded-2xl border-2 border-dashed opacity-50 border-border">
                    <p className="text-sm">
                      No documents found. Start by creating one!
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
          <div className="space-y-10">
            <section className="p-6 rounded-3xl border bg-muted/20 border-border/50">
              <div className="flex gap-2 items-center mb-6">
                <StarIcon size={16} className="text-yellow-500 fill-current" />
                <h2 className="text-sm font-bold tracking-widest uppercase">
                  Favorites
                </h2>
              </div>
              <div className="space-y-4">
                {favorites.map((note: Note) => (
                  <Link
                    key={note.id}
                    to={`/note/${note.id}`}
                    className="block pb-2 mb-1 border-b shadow-sm transition-all border-border group hover:border-primary/30"
                  >
                    <h4 className="text-sm font-medium transition-colors truncate group-hover:text-primary">
                      {note.title}
                    </h4>
                    <p className="overflow-hidden mt-1 text-xs text-ellipsis line-clamp-1 max-w-64 text-muted-foreground truncate">
                      {note.content.substring(0, 60).replace(/[#*`]/g, "") ||
                        "No content"}
                    </p>
                  </Link>
                ))}
                {favorites.length === 0 && (
                  <div className="py-8 text-center opacity-40">
                    <p className="text-xs">
                      Mark notes as favorites to see them here.
                    </p>
                  </div>
                )}
              </div>
            </section>
            <section className="relative p-6 rounded-3xl shadow-md overflow-clip text-foreground shadow-primary/20">
              <div className="absolute inset-0 bg-primary/70 mix-blend-overlay"></div>
              <div className="relative">
                <h3 className="mb-2 text-xl font-bold">Keep Writing</h3>
                <p className="mb-4 text-sm leading-relaxed text-foreground/80">
                  "The first draft is just you telling yourself the story."
                </p>
                <Tag size="small" theme="primary">
                  {state.notes.length} Total Documents
                </Tag>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10 transform rotate-12">
                <FileTextIcon size={120} />
              </div>
            </section>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
