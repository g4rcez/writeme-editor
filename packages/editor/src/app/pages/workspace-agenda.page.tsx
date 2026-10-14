import { Button } from "@g4rcez/components";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CalendarDotsIcon } from "@phosphor-icons/react/dist/csr/CalendarDots";
import { CheckSquareIcon } from "@phosphor-icons/react/dist/csr/CheckSquare";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getOrCreateDailyQuickNote } from "@/lib/daily-quick-note";
import { Dates } from "@/lib/dates";
import { findDailyQuickNote, parseJournalDay } from "@/lib/journal-date";
import { parseOpenWorkspaceTasks, type WorkspaceTask } from "@/lib/workspace-tasks";
import { useGlobalStore } from "@/store/global.store";
import { NoteType } from "@/store/note";
import { repositories } from "@/store/repositories";

type LoadState = "loading" | "ready" | "error";

function formatJournalDate(date: Date): string {
    return Dates.isoDate(date);
}

function TaskRow({ task }: { task: WorkspaceTask }): JSX.Element {
    return (
        <li className="border-b border-border last:border-b-0">
            <Link
                to={`/note/${encodeURIComponent(task.noteId)}?task=${task.taskIndex}&line=${task.line}`}
                className="flex min-h-12 w-full flex-col items-start justify-center gap-1 px-3 py-2 text-left hover:bg-secondary-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Open ${task.title} in ${task.noteTitle}${task.heading ? `, ${task.heading}` : ""}`}
            >
                <span className="text-sm text-foreground">{task.title}</span>
                <span className="text-xs text-muted-foreground">
                    {task.noteTitle}
                    {task.heading ? ` · ${task.heading}` : ""}
                </span>
            </Link>
        </li>
    );
}

function TaskList({ tasks }: { tasks: WorkspaceTask[] }): JSX.Element {
    if (tasks.length === 0) {
        return <p className="px-3 py-5 text-sm text-muted-foreground">No open tasks in this workspace.</p>;
    }
    return (
        <ul className="divide-y divide-border">
            {tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
            ))}
        </ul>
    );
}

export default function WorkspaceAgendaPage(): JSX.Element {
    const [state, dispatch] = useGlobalStore();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const isToday = location.pathname.endsWith("/today");
    const [loadState, setLoadState] = useState<LoadState>("loading");
    const [loadError, setLoadError] = useState("");
    const [actionError, setActionError] = useState("");
    const [openingDaily, setOpeningDaily] = useState(false);
    const requestVersion = useRef(0);
    const dailyRequest = useRef<AbortController | null>(null);
    useEffect(() => () => dailyRequest.current?.abort(), [location.pathname, location.search]);
    const date = useMemo(() => parseJournalDay(searchParams.get("date")) ?? new Date(), [searchParams]);
    const loadedNotes = state.notes.filter((note) => !note.deletedAt && note.noteType !== NoteType.template);
    const tasks = useMemo(() => parseOpenWorkspaceTasks(state.notes), [state.notes]);
    const dailyNote = findDailyQuickNote(loadedNotes, date);
    const recentNotes = useMemo(
        () => [...loadedNotes].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()).slice(0, 5),
        [loadedNotes],
    );

    const loadNotes = useCallback(
        async (signal?: AbortSignal): Promise<void> => {
            const version = ++requestVersion.current;
            setLoadState("loading");
            setLoadError("");
            try {
                const notes = await repositories.notes.getAll();
                if (requestVersion.current !== version || signal?.aborted) return;
                dispatch.notes(notes);
                setLoadState("ready");
            } catch (error) {
                if (requestVersion.current !== version || signal?.aborted) return;
                setLoadError(error instanceof Error ? error.message : "Workspace notes could not be loaded.");
                setLoadState("error");
            }
        },
        [dispatch],
    );

    useEffect(() => {
        const controller = new AbortController();
        queueMicrotask(() => {
            if (!controller.signal.aborted) void loadNotes(controller.signal);
        });
        return () => {
            controller.abort();
        };
    }, [loadNotes, location.pathname]);

    const openDailyNote = async (): Promise<void> => {
        dailyRequest.current?.abort();
        const controller = new AbortController();
        dailyRequest.current = controller;
        const requestLocation = window.location.href;
        const isCurrent = (): boolean =>
            !controller.signal.aborted && window.location.href === requestLocation;
        setOpeningDaily(true);
        setActionError("");
        try {
            const note = await getOrCreateDailyQuickNote(date);
            if (!isCurrent()) return;
            navigate(`/note/${encodeURIComponent(note.id)}`);
        } catch (error) {
            if (!isCurrent()) return;
            setActionError(error instanceof Error ? error.message : "The daily note could not be opened.");
        } finally {
            if (isCurrent()) setOpeningDaily(false);
        }
    };

    const changeDate = (amount: number): void => {
        dailyRequest.current?.abort();
        const next = new Date(date);
        next.setDate(next.getDate() + amount);
        setSearchParams({ date: formatJournalDate(next) });
    };

    const selectDate = (value: string): void => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
        const selected = parseJournalDay(value);
        if (!selected) return;
        dailyRequest.current?.abort();
        setSearchParams({ date: formatJournalDate(selected) });
    };

    return (
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-5 overflow-y-auto px-4 py-6 sm:px-6">
            <header className="flex shrink-0 flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-sm text-muted-foreground">Workspace</p>
                    <h1 className="mt-1 text-2xl font-semibold text-foreground">{isToday ? "Today" : "Open tasks"}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {isToday
                            ? "A calm place to pick up your day."
                            : "Unfinished Markdown tasks from across your notes."}
                    </p>
                </div>
                {!isToday && (
                    <Link
                        className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-foreground hover:bg-secondary-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        to="/today"
                    >
                        <CalendarDotsIcon size={17} aria-hidden="true" />
                        Today
                    </Link>
                )}
            </header>

            {loadState === "loading" && (
                <output className="text-sm text-muted-foreground">Loading workspace notes…</output>
            )}
            {actionError && (
                <p role="alert" className="text-sm text-foreground">
                    {actionError} Try opening the daily note again.
                </p>
            )}
            {loadState === "error" && (
                <section
                    role="alert"
                    className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4"
                >
                    <p className="text-sm text-foreground">{loadError || "Workspace notes could not be loaded."}</p>
                    <Button theme="muted" onClick={() => void loadNotes()}>
                        Retry
                    </Button>
                </section>
            )}

            {loadState === "ready" && isToday && (
                <section aria-labelledby="daily-note-heading" className="shrink-0 rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 id="daily-note-heading" className="font-medium text-foreground">
                                Daily note
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">{Dates.yearMonthDay(date)}</p>
                            {dailyNote && <p className="mt-1 text-xs text-muted-foreground">{dailyNote.title}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                aria-label="Previous day"
                                className="min-h-11 min-w-11 rounded-md text-foreground hover:bg-secondary-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => changeDate(-1)}
                            >
                                <ArrowLeftIcon size={18} aria-hidden="true" />
                            </button>
                            <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                                Journal date
                                <input
                                    aria-label="Journal date"
                                    type="date"
                                    value={formatJournalDate(date)}
                                    onChange={(event) => selectDate(event.target.value)}
                                    className="min-h-11 min-w-0 max-w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
                                />
                            </label>
                            <button
                                type="button"
                                aria-label="Next day"
                                className="min-h-11 min-w-11 rounded-md text-foreground hover:bg-secondary-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => changeDate(1)}
                            >
                                <ArrowRightIcon size={18} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <Button disabled={openingDaily} onClick={() => void openDailyNote()}>
                            {openingDaily ? "Opening daily note…" : dailyNote ? "Open daily note" : "Create daily note"}
                        </Button>
                    </div>
                </section>
            )}

            {loadState === "ready" && (
                <section
                    aria-labelledby="open-tasks-heading"
                    className="shrink-0 overflow-hidden rounded-lg border border-border"
                >
                    <header className="flex items-center justify-between gap-3 px-4 py-3">
                        <h2 id="open-tasks-heading" className="flex items-center gap-2 font-medium text-foreground">
                            <CheckSquareIcon size={17} aria-hidden="true" />
                            {isToday ? "Unfinished tasks" : "Open tasks"}
                        </h2>
                        <span className="text-xs text-muted-foreground">{tasks.length}</span>
                    </header>
                    <TaskList tasks={tasks} />
                </section>
            )}

            {loadState === "ready" && isToday && (
                <section
                    aria-labelledby="recent-work-heading"
                    className="shrink-0 overflow-hidden rounded-lg border border-border"
                >
                    <header className="px-4 py-3">
                        <h2 id="recent-work-heading" className="flex items-center gap-2 font-medium text-foreground">
                            <ClockCounterClockwiseIcon size={17} aria-hidden="true" />
                            Recent work
                        </h2>
                    </header>
                    {recentNotes.length === 0 ? (
                        <p className="px-4 pb-4 text-sm text-muted-foreground">
                            Your recent notes will appear here as you work.
                        </p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {recentNotes.map((note) => (
                                <li key={note.id}>
                                    <Link
                                        to={`/note/${encodeURIComponent(note.id)}`}
                                        className="flex min-h-12 w-full flex-col items-start justify-center px-4 py-2 text-left hover:bg-secondary-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <span className="text-sm text-foreground">{note.title}</span>
                                        <span className="text-xs text-muted-foreground">
                                            Updated {Dates.yearMonthDay(note.updatedAt)}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}
        </div>
    );
}
