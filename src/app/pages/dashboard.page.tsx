import { Button, Tag } from "@g4rcez/components";
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
    className?: string;
};

function ActionCard({ title, description, icon: Icon, onClick, shortcut, className }: ActionCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={title}
            className={`group flex min-h-36 flex-col items-start gap-4 p-5 text-left transition-[background-color,transform] duration-150 ease-out hover:bg-muted/20 active:scale-[0.99] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${className ?? ""}`}
        >
            <span className="flex w-full items-center justify-between gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                    <Icon size={20} strokeWidth={1.6} />
                </span>
                <kbd className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                    {shortcut}
                </kbd>
            </span>
            <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground group-hover:text-primary">{title}</span>
                <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>
            </span>
        </button>
    );
}

function RecentNoteCard({ note }: { note: Note }) {
    return (
        <li>
            <Link
                to={`/note/${note.id}`}
                className="group flex items-center gap-4 px-5 py-4 transition-[background-color,transform] duration-150 ease-out hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <FileTextIcon size={19} />
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
                                <TagIcon size={12} />
                                <span className="truncate">{note.tags[0]}</span>
                            </span>
                        ) : null}
                    </span>
                </span>
                <ArrowRightIcon
                    size={16}
                    className="shrink-0 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100"
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
        if (state.directory) {
            window.electronAPI.env.getHome().then((home) => {
                setCwd(tildaDir(home, state.directory ?? home));
            });
        } else if (window.electronAPI) {
            window.electronAPI.env.getHome().then(setCwd);
        }

        const hour = new Date().getHours();
        if (hour < 12) setGreeting("Good morning");
        else if (hour < 18) setGreeting("Good afternoon");
        else setGreeting("Good evening");
    }, [state.directory]);

    const onSearch = () => dispatch.commander(true, CommanderType.Notes);

    const createNewNote = () => dispatch.setCreateNoteDialog({ isOpen: true, type: "note" });

    const openAiAssistant = () => navigate("/chat");

    const favoriteNotes = state.notes.filter((note: Note) => note.favorite);
    const favorites = favoriteNotes.slice(0, 4);
    const recent = state.notes.slice(0, 6);

    return (
        <div className="min-h-full bg-background selection:bg-primary/20">
            <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 xl:px-10 2xl:px-12">
                <header className="border-b border-border/30 pb-7">
                    <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
                        <div className="max-w-3xl">
                            <p className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-primary">
                                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                                {greeting} · your private workspace
                            </p>
                            <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-foreground lg:text-5xl">
                                Just you and your thoughts.
                            </h1>
                            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                                A calm place for notes, ideas, and the work that matters. Everything stays local, with
                                AI available when you want a second pair of eyes.
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                            <Button
                                type="button"
                                theme="primary"
                                size="big"
                                onClick={createNewNote}
                                className="inline-flex items-center justify-center gap-3 active:scale-[0.99]"
                            >
                                <FilePlusIcon size={18} />
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
                                className="inline-flex items-center justify-center gap-3 active:scale-[0.99]"
                            >
                                <MagnifyingGlassIcon size={18} />
                                <span>Find anything</span>
                                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                    ⌘ K
                                </kbd>
                            </Button>
                        </div>
                    </div>

                    <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/30 pt-4 text-xs">
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

                <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_19rem] 2xl:gap-12">
                    <div className="min-w-0 space-y-10">
                        <section aria-labelledby="recent-notes-heading">
                            <div className="flex flex-wrap items-end justify-between gap-4">
                                <div>
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                        Your desk
                                    </p>
                                    <h2 id="recent-notes-heading" className="text-xl font-semibold text-foreground">
                                        Pick up where you left off
                                    </h2>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                        Your most recently changed notes, ready when you are.
                                    </p>
                                </div>
                                <Link
                                    to="/notes"
                                    className="group flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                    All notes
                                    <ArrowRightIcon
                                        size={14}
                                        className="transition-transform group-hover:translate-x-0.5"
                                    />
                                </Link>
                            </div>
                            <div className="mt-5 overflow-hidden rounded-2xl border border-border/40 bg-card-background">
                                {recent.length > 0 ? (
                                    <ul className="divide-y divide-border/30">
                                        {recent.map((note: Note) => (
                                            <RecentNoteCard key={note.id} note={note} />
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                                        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                            <FileTextIcon size={22} />
                                        </span>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                Start with one small thought.
                                            </p>
                                            <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                                                A blank page is only an invitation. Open a note and let the first line
                                                do the work.
                                            </p>
                                        </div>
                                        <Button type="button" theme="outlined" size="small" onClick={createNewNote}>
                                            Create a note
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="border-t border-border/30 pt-8" aria-labelledby="shortcuts-heading">
                            <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                    Shortcuts
                                </p>
                                <h2 id="shortcuts-heading" className="text-xl font-semibold text-foreground">
                                    A quieter way to work
                                </h2>
                                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                    Keep the important actions close without breaking your flow.
                                </p>
                            </div>
                            <div className="mt-5 grid overflow-hidden rounded-2xl border border-border/40 bg-card-background divide-y divide-border/30 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                                <ActionCard
                                    title="Start writing"
                                    description="Open a clean writing column."
                                    icon={FilePlusIcon}
                                    shortcut="⌘ N"
                                    onClick={createNewNote}
                                />
                                <ActionCard
                                    title="Search everything"
                                    description="Move through notes and actions."
                                    icon={MagnifyingGlassIcon}
                                    shortcut="⌘ K"
                                    onClick={onSearch}
                                />
                                <ActionCard
                                    title="Ask AI"
                                    description="Find structure without leaving the note."
                                    icon={RobotIcon}
                                    shortcut="AI"
                                    onClick={openAiAssistant}
                                />
                            </div>
                        </section>
                    </div>

                    <aside className="xl:pt-1">
                        <section aria-labelledby="starred-notes-heading">
                            <div className="flex items-end justify-between gap-3">
                                <div>
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                        Keep close
                                    </p>
                                    <h2 id="starred-notes-heading" className="text-xl font-semibold text-foreground">
                                        Starred notes
                                    </h2>
                                </div>
                                <StarIcon size={18} className="fill-current text-muted-foreground" />
                            </div>
                            {favorites.length > 0 ? (
                                <ul className="mt-4 space-y-1">
                                    {favorites.map((note: Note) => (
                                        <li key={note.id}>
                                            <Link
                                                to={`/note/${note.id}`}
                                                className="group flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                            >
                                                <StarIcon
                                                    size={14}
                                                    weight="fill"
                                                    className="mt-0.5 shrink-0 text-warn"
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
                                                        {note.title || "Untitled"}
                                                    </span>
                                                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                                                        {note.content.substring(0, 90).replace(/[#*`]/g, "") ||
                                                            "No content"}
                                                    </span>
                                                </span>
                                                <ArrowRightIcon
                                                    size={14}
                                                    className="mt-0.5 shrink-0 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100"
                                                />
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                                    Star the notes you return to often and they will stay one gesture away.
                                </p>
                            )}
                        </section>

                        <section
                            className="mt-8 rounded-2xl border border-border/40 bg-card-background p-5"
                            aria-labelledby="local-first-heading"
                        >
                            <div className="flex items-start gap-3">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-primary">
                                    <FileTextIcon size={18} />
                                </span>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                        Local by default
                                    </p>
                                    <h2
                                        id="local-first-heading"
                                        className="mt-1 text-base font-semibold text-foreground"
                                    >
                                        Your notes stay yours.
                                    </h2>
                                </div>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-muted-foreground">
                                Write Me keeps your notes in formats you control, with AI available when you choose it.
                            </p>
                            <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/40 pt-3">
                                <span className="text-xs text-muted-foreground">Workspace notes</span>
                                <Tag size="small" theme="muted">
                                    {state.notes.length}
                                </Tag>
                            </div>
                        </section>
                    </aside>
                </div>
            </main>
        </div>
    );
}
