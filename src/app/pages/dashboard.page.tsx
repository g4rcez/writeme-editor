import { Button } from "@g4rcez/components";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { FilePlusIcon } from "@phosphor-icons/react/dist/csr/FilePlus";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { RobotIcon } from "@phosphor-icons/react/dist/csr/Robot";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { TagIcon } from "@phosphor-icons/react/dist/csr/Tag";
import { type ComponentType, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Note } from "@/store/note";
import { Dates } from "@/lib/dates";
import { tildaDir } from "@/lib/file-utils";
import { CommanderType, useGlobalStore } from "@/store/global.store";

type DashboardIcon = ComponentType<{
    size?: number;
    className?: string;
    strokeWidth?: number;
}>;

type ActionCardProps = {
    icon: DashboardIcon;
    title: string;
    description: string;
    shortcut: string;
    onClick: () => void;
};

function ActionCard({ title, description, icon: Icon, onClick, shortcut }: ActionCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={title}
            className="group flex min-h-24 items-center gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/30 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:min-h-28 sm:border-b-0 sm:border-r sm:px-5 sm:last:border-r-0"
        >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <Icon size={18} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground group-hover:text-primary">{title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
            </span>
            <kbd className="shrink-0 rounded-md bg-muted px-1.5 py-1 font-mono text-[10px] text-muted-foreground">
                {shortcut}
            </kbd>
        </button>
    );
}

function RecentNoteRow({ note }: { note: Note }) {
    return (
        <li>
            <Link
                to={`/note/${note.id}`}
                className="group flex min-h-16 items-center gap-3 border-b border-border/35 px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/30 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:gap-4 sm:px-5"
            >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <FileTextIcon size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
                            {note.title || "Untitled"}
                        </span>
                        {note.favorite ? <StarIcon size={12} weight="fill" className="shrink-0 text-warn" /> : null}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <time dateTime={new Date(note.updatedAt).toISOString()}>
                            {Dates.yearMonthDay(new Date(note.updatedAt))}
                        </time>
                        {note.tags.length > 0 ? (
                            <span className="flex min-w-0 items-center gap-1">
                                <TagIcon size={12} aria-hidden="true" />
                                <span className="truncate">{note.tags[0]}</span>
                            </span>
                        ) : null}
                    </span>
                </span>
                <ArrowRightIcon
                    size={16}
                    className="shrink-0 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100"
                    aria-hidden="true"
                />
            </Link>
        </li>
    );
}

export default function DashboardPage() {
    const [state, dispatch] = useGlobalStore();
    const navigate = useNavigate();
    const [cwd, setCwd] = useState<string | null>(null);
    const [greeting, setGreeting] = useState("");

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting("Good morning");
        else if (hour < 18) setGreeting("Good afternoon");
        else setGreeting("Good evening");

        if (!window.electronAPI) return;
        if (state.directory) {
            window.electronAPI.env.getHome().then((home) => {
                setCwd(tildaDir(home, state.directory ?? home));
            });
        } else {
            window.electronAPI.env.getHome().then(setCwd);
        }
    }, [state.directory]);

    const onSearch = () => dispatch.commander(true, CommanderType.Notes);
    const createNewNote = () => dispatch.setCreateNoteDialog({ isOpen: true, type: "note" });
    const openAiAssistant = () => navigate("/chat");

    const favoriteNotes = state.notes.filter((note: Note) => note.favorite);
    const favorites = favoriteNotes.slice(0, 4);
    const recent = state.notes.slice(0, 6);

    return (
        <div className="writeme-home-shell min-h-full bg-background selection:bg-primary/20">
            <section className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
                <header className="writeme-home-welcome border-b border-border/45 pb-6">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="min-w-0 max-w-2xl">
                            <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                                {greeting || "Your private workspace"}
                            </p>
                            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
                                Make space for the next idea.
                            </h1>
                            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                                Write, connect, and find your thinking without leaving your workspace.
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                            <Button
                                type="button"
                                theme="primary"
                                size="big"
                                onClick={createNewNote}
                                className="inline-flex items-center justify-center gap-2 active:scale-[0.99]"
                            >
                                <FilePlusIcon size={17} aria-hidden="true" />
                                <span>New note</span>
                                <kbd className="rounded bg-button-primary-text/15 px-1.5 py-0.5 font-mono text-[10px] text-button-primary-text/80">
                                    ⌘ N
                                </kbd>
                            </Button>
                            <Button
                                type="button"
                                theme="outlined"
                                size="big"
                                onClick={onSearch}
                                className="inline-flex items-center justify-center gap-2 active:scale-[0.99]"
                            >
                                <MagnifyingGlassIcon size={17} aria-hidden="true" />
                                <span>Find anything</span>
                                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                    ⌘ K
                                </kbd>
                            </Button>
                        </div>
                    </div>
                    <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                        <span className="text-muted-foreground">Workspace</span>
                        <span className="max-w-full truncate font-mono text-foreground" title={cwd ?? undefined}>
                            {cwd ?? "Local files"}
                        </span>
                        <span className="hidden h-3 w-px bg-border/60 sm:block" aria-hidden="true" />
                        <span className="text-muted-foreground">
                            <strong className="font-semibold text-foreground">{state.notes.length}</strong> notes
                        </span>
                        <span className="text-muted-foreground">
                            <strong className="font-semibold text-foreground">{favoriteNotes.length}</strong> starred
                        </span>
                    </div>
                </header>

                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] xl:gap-10">
                    <section aria-labelledby="recent-notes-heading" className="min-w-0">
                        <div className="flex items-end justify-between gap-4">
                            <div>
                                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                    Your desk
                                </p>
                                <h2 id="recent-notes-heading" className="text-xl font-semibold text-foreground">
                                    Pick up where you left off
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Recently changed notes, ready when you are.
                                </p>
                            </div>
                            <Link
                                to="/notes"
                                className="group flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                All notes
                                <ArrowRightIcon
                                    size={14}
                                    className="transition-transform group-hover:translate-x-0.5"
                                />
                            </Link>
                        </div>
                        <div className="mt-4 overflow-hidden rounded-xl border border-border/45 bg-card-background">
                            {recent.length > 0 ? (
                                <ul>
                                    {recent.map((note: Note) => (
                                        <RecentNoteRow key={note.id} note={note} />
                                    ))}
                                </ul>
                            ) : (
                                <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <FileTextIcon size={20} aria-hidden="true" />
                                    </span>
                                    <div className="max-w-[32rem]">
                                        <p className="text-sm font-medium text-foreground">
                                            Start with one small thought.
                                        </p>
                                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                            Your first note will become the starting point for everything you build
                                            here.
                                        </p>
                                    </div>
                                    <Button type="button" theme="outlined" size="small" onClick={createNewNote}>
                                        Create a note
                                    </Button>
                                </div>
                            )}
                        </div>
                    </section>

                    <aside className="min-w-0">
                        <section aria-labelledby="starred-notes-heading">
                            <div className="flex items-end justify-between gap-3">
                                <div>
                                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                        Keep close
                                    </p>
                                    <h2 id="starred-notes-heading" className="text-xl font-semibold text-foreground">
                                        Starred notes
                                    </h2>
                                </div>
                                <StarIcon size={17} className="fill-current text-muted-foreground" aria-hidden="true" />
                            </div>
                            {favorites.length > 0 ? (
                                <ul className="mt-3 divide-y divide-border/35">
                                    {favorites.map((note) => (
                                        <li key={note.id}>
                                            <Link
                                                to={`/note/${note.id}`}
                                                className="group flex items-start gap-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                <StarIcon size={13} weight="fill" className="mt-1 shrink-0 text-warn" />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
                                                        {note.title || "Untitled"}
                                                    </span>
                                                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                                                        {note.content.substring(0, 90).replace(/[#*`]/g, "") ||
                                                            "No content"}
                                                    </span>
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                    Star the notes you return to often and they will stay one gesture away.
                                </p>
                            )}
                        </section>

                        <section
                            className="mt-7 overflow-hidden rounded-xl border border-border/45 bg-card-background"
                            aria-labelledby="quick-actions-heading"
                        >
                            <div className="border-b border-border/40 px-4 py-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                    Shortcuts
                                </p>
                                <h2 id="quick-actions-heading" className="mt-1 text-base font-semibold text-foreground">
                                    Keep your flow
                                </h2>
                            </div>
                            <div className="sm:grid sm:grid-cols-3 lg:block">
                                <ActionCard
                                    title="Start writing"
                                    description="Open a clean page."
                                    icon={FilePlusIcon}
                                    shortcut="⌘ N"
                                    onClick={createNewNote}
                                />
                                <ActionCard
                                    title="Search everything"
                                    description="Jump to a note or action."
                                    icon={MagnifyingGlassIcon}
                                    shortcut="⌘ K"
                                    onClick={onSearch}
                                />
                                <ActionCard
                                    title="Ask AI"
                                    description="Bring in a second pair of eyes."
                                    icon={RobotIcon}
                                    shortcut="AI"
                                    onClick={openAiAssistant}
                                />
                            </div>
                        </section>
                    </aside>
                </div>
            </section>
        </div>
    );
}
