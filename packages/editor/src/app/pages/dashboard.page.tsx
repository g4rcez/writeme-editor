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
    shortcut: string | null;
    onClick: () => void;
};

function ActionCard({ title, description, icon: Icon, onClick, shortcut }: ActionCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={title}
            className="group flex min-h-20 items-center gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/30 active:bg-muted/50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:border-b-0 md:border-r md:px-4 md:last:border-r-0"
        >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <Icon size={18} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground group-hover:text-primary">{title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
            </span>
            {shortcut ? (
                <kbd className="shrink-0 rounded-md bg-muted px-1.5 py-1 font-mono text-[10px] text-muted-foreground">
                    {shortcut}
                </kbd>
            ) : null}
        </button>
    );
}

function getNotePreview(content: string): string {
    return content.slice(0, 160).replace(/[#*`]/g, "").replace(/\s+/g, " ").trim() || "No content yet";
}

function RecentNoteRow({ note }: { note: Note }) {
    return (
        <li>
            <Link
                to={`/note/${note.id}`}
                className="group flex min-h-20 items-center gap-3 border-b border-border/35 px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/30 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:gap-4 sm:px-5"
            >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <FileTextIcon size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
                            {note.title || "Untitled"}
                        </span>
                        {note.favorite ? (
                            <StarIcon size={12} weight="fill" className="shrink-0 text-warn" aria-hidden="true" />
                        ) : null}
                    </span>
                    <span className="mt-1 block truncate text-xs leading-5 text-muted-foreground">
                        {getNotePreview(note.content)}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
                    className="shrink-0 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100"
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
            <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
                <header className="relative isolate overflow-hidden rounded-2xl border border-border/55 bg-gradient-to-br from-primary/10 via-card-background to-card-background p-5 shadow-sm shadow-primary/5 sm:p-7 xl:p-8">
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -right-16 -top-20 hidden size-64 rounded-full border border-primary/10 sm:block"
                    />
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute right-10 top-8 hidden size-32 rounded-full border border-primary/10 sm:block"
                    />
                    <div className="relative">
                        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                            <div className="min-w-0 max-w-2xl">
                                <p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                                    <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                                    {greeting || "Your private workspace"}
                                </p>
                                <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
                                    Make space for <span className="text-primary">the next idea.</span>
                                </h1>
                                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                                    Write, connect, and find your thinking without leaving your workspace.
                                </p>
                            </div>
                            <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto xl:shrink-0">
                                <Button
                                    type="button"
                                    theme="primary"
                                    onClick={createNewNote}
                                >
                                    <FilePlusIcon size={17} aria-hidden="true" />
                                    <span>New note</span>
                                    <kbd className="rounded bg-button-primary-text/15 px-1.5 py-0.5 font-mono text-xs text-button-primary-text/80">⌘ N</kbd>
                                </Button>
                                <Button
                                    type="button"
                                    theme="outlined"
                                    onClick={onSearch}
                                >
                                    <MagnifyingGlassIcon size={17} aria-hidden="true" />
                                    <span>Find anything</span>
                                    <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                        ⌘ K
                                    </kbd>
                                </Button>
                            </div>
                        </div>
                        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border/45 pt-4">
                            <span className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg border border-border/45 bg-background/40 px-3 py-1 text-xs">
                                <span className="shrink-0 text-muted-foreground">Workspace</span>
                                <span className="min-w-0 truncate font-mono text-foreground" title={cwd ?? undefined}>
                                    {cwd ?? "Local files"}
                                </span>
                            </span>
                            <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border/45 bg-background/40 px-3 py-1 text-xs text-muted-foreground">
                                <FileTextIcon size={14} aria-hidden="true" />
                                <strong className="font-semibold text-foreground">{state.notes.length}</strong>
                                {state.notes.length === 1 ? "note" : "notes"}
                            </span>
                            <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border/45 bg-background/40 px-3 py-1 text-xs text-muted-foreground">
                                <StarIcon size={14} aria-hidden="true" />
                                <strong className="font-semibold text-foreground">{favoriteNotes.length}</strong>
                                starred
                            </span>
                        </div>
                    </div>
                </header>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-8">
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
                                className="group flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                All notes
                                <ArrowRightIcon
                                    size={14}
                                    className="transition-transform group-hover:translate-x-0.5"
                                    aria-hidden="true"
                                />
                            </Link>
                        </div>
                        <div className="mt-4 overflow-hidden rounded-2xl border border-border/45 bg-card-background/70 shadow-sm shadow-background/10">
                            {recent.length > 0 ? (
                                <ul>
                                    {recent.map((note: Note) => (
                                        <RecentNoteRow key={note.id} note={note} />
                                    ))}
                                </ul>
                            ) : (
                                <div className="flex min-h-40 flex-col justify-between gap-5 px-5 py-5 sm:flex-row sm:items-center">
                                    <div className="flex min-w-0 items-start gap-4">
                                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
                                    </div>
                                    <Button
                                        type="button"
                                        theme="outlined"
                                        size="small"
                                        onClick={createNewNote}
                                        className="w-full sm:w-auto"
                                    >
                                        Create a note
                                    </Button>
                                </div>
                            )}
                        </div>
                    </section>

                    <aside className="min-w-0">
                        <section
                            className="rounded-2xl border border-border/45 bg-card-background/70 p-4 shadow-sm shadow-background/10 sm:p-5"
                            aria-labelledby="starred-notes-heading"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                        Keep close
                                    </p>
                                    <h2 id="starred-notes-heading" className="text-xl font-semibold text-foreground">
                                        Starred notes
                                    </h2>
                                </div>
                                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <StarIcon size={17} aria-hidden="true" />
                                </span>
                            </div>
                            {favorites.length > 0 ? (
                                <ul className="mt-4 divide-y divide-border/35">
                                    {favorites.map((note) => (
                                        <li key={note.id}>
                                            <Link
                                                to={`/note/${note.id}`}
                                                className="group flex min-h-11 items-start gap-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                <StarIcon
                                                    size={13}
                                                    weight="fill"
                                                    className="mt-1 shrink-0 text-warn"
                                                    aria-hidden="true"
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
                                                        {note.title || "Untitled"}
                                                    </span>
                                                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                                                        {getNotePreview(note.content)}
                                                    </span>
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="mt-4 rounded-xl border border-dashed border-border/55 bg-background/40 p-4">
                                    <p className="text-sm font-medium text-foreground">No starred notes yet</p>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                        Star the notes you return to often and they will stay one gesture away.
                                    </p>
                                    <Link
                                        to="/notes"
                                        className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        Browse notes
                                        <ArrowRightIcon size={14} aria-hidden="true" />
                                    </Link>
                                </div>
                            )}
                        </section>
                    </aside>

                    <section
                        className="overflow-hidden rounded-2xl border border-border/45 bg-card-background/70 shadow-sm shadow-background/10 xl:col-span-2"
                        aria-labelledby="quick-actions-heading"
                    >
                        <div className="flex flex-col gap-1 border-b border-border/40 px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-5">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                    Shortcuts
                                </p>
                                <h2 id="quick-actions-heading" className="mt-1 text-base font-semibold text-foreground">
                                    Keep your flow
                                </h2>
                            </div>
                            <p className="text-xs text-muted-foreground">Common actions, close at hand.</p>
                        </div>
                        <div className="grid md:grid-cols-3">
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
                                shortcut={null}
                                onClick={openAiAssistant}
                            />
                        </div>
                    </section>
                </div>
            </section>
        </div>
    );
}
