import {
    Button,
    type CalendarEvent,
    type CalendarFilter,
    formatTime,
    Input,
    Modal,
    PageCalendar,
    type TagProps,
    useLocale,
} from "@g4rcez/components";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getOrCreateDailyQuickNote } from "@/lib/daily-quick-note";
import { Dates } from "@/lib/dates";
import { getJournalDate, parseJournalDay } from "@/lib/journal-date";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";

const NOTE_TYPE_COLORS: Record<NoteType, string> = {
    "read-it-later": "bg-tag-info-bg text-tag-info-text",
    [NoteType.quick]: "bg-tag-warn-bg text-tag-warn-text",
    [NoteType.math]: "bg-tag-neutral-bg text-tag-neutral-text",
    [NoteType.note]: "bg-tag-primary-bg text-tag-primary-text",
    [NoteType.json]: "bg-tag-secondary-bg text-tag-secondary-text",
    [NoteType.freehand]: "bg-tag-success-bg text-tag-success-text",
    [NoteType.task]: "bg-tag-primary-bg text-tag-primary-text",
    [NoteType.pdf]: "bg-tag-info-bg text-tag-info-text",
    [NoteType.excalidraw]: "bg-tag-neutral-bg text-tag-neutral-text",
    [NoteType["meeting-note"]]: "bg-tag-info-bg text-tag-info-text",
    [NoteType.template]: "bg-tag-danger-bg text-tag-danger-text",
};

const NOTE_TYPE_FILTER_THEMES: Record<NoteType, TagProps["theme"]> = {
    "read-it-later": "info",
    [NoteType.quick]: "warn",
    [NoteType.math]: "neutral",
    [NoteType.note]: "primary",
    [NoteType.json]: "secondary",
    [NoteType.freehand]: "success",
    [NoteType.task]: "primary",
    [NoteType.pdf]: "info",
    [NoteType.excalidraw]: "neutral",
    [NoteType["meeting-note"]]: "info",
    [NoteType.template]: "danger",
};

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
    note: "Note",
    quick: "Quick",
    math: "Math",
    "read-it-later": "Read Later",
    template: "Template",
    json: "JSON",
    freehand: "Freehand",
    task: "Task board",
    pdf: "PDF",
    excalidraw: "Excalidraw",
    "meeting-note": "Meeting note",
};

const CALENDAR_FILTERS: CalendarFilter[] = Object.values(NoteType).map((type) => ({
    id: type,
    label: NOTE_TYPE_LABELS[type],
    theme: NOTE_TYPE_FILTER_THEMES[type],
    enabled: true,
}));

export default function CalendarPage() {
    const locale = useLocale();
    const [state, dispatch] = useGlobalStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const location = useLocation();

    const [filters, setFilters] = useState<CalendarFilter[]>(CALENDAR_FILTERS);
    const [createEventDate, setCreateEventDate] = useState<Date | null>(null);
    const [newEventTitle, setNewEventTitle] = useState("");
    const [newEventType, setNewEventType] = useState<NoteType>(NoteType.note);
    const [dailyError, setDailyError] = useState("");
    const [openingDaily, setOpeningDaily] = useState(false);
    const dailyRequest = useRef<AbortController | null>(null);
    useEffect(() => () => dailyRequest.current?.abort(), [location.pathname, location.search]);

    const changeEventDate = (date: Date | null): void => {
        dailyRequest.current?.abort();
        setOpeningDaily(false);
        setDailyError("");
        setCreateEventDate(date);
    };

    useEffect(() => {
        if (createEventDate !== null) {
            setNewEventTitle("");
            setNewEventType(NoteType.note);
            setDailyError("");
        }
    }, [createEventDate]);

    const activeFilterIds = useMemo(() => filters.filter((f) => f.enabled).map((f) => f.id), [filters]);

    const calendarEvents = useMemo<CalendarEvent[]>(
        () =>
            state.notes
                .filter((n) => !n.deletedAt && activeFilterIds.includes(n.noteType))
                .map((note) => ({
                    id: note.id,
                    title: note.title,
                    date: getJournalDate(note) ?? new Date(note.createdAt),
                    filterId: note.noteType,
                    className: NOTE_TYPE_COLORS[note.noteType],
                })),
        [state.notes, activeFilterIds],
    );

    const noteById = useMemo(() => new Map(state.notes.map((n) => [n.id, n])), [state.notes]);

    const onEventClick = (event: CalendarEvent) => {
        dispatch.selectNoteById(event.id);
        navigate("/note/" + event.id);
    };

    const onAddEvent = () => dispatch.setCreateNoteDialog({ isOpen: true, type: "note" });

    const openDailyNote = async (): Promise<void> => {
        if (!createEventDate) return;
        dailyRequest.current?.abort();
        const controller = new AbortController();
        dailyRequest.current = controller;
        setOpeningDaily(true);
        setDailyError("");
        try {
            const note = await getOrCreateDailyQuickNote(createEventDate);
            if (controller.signal.aborted) return;
            setCreateEventDate(null);
            navigate(`/note/${note.id}`);
        } catch (error) {
            if (controller.signal.aborted) return;
            setDailyError(error instanceof Error ? error.message : "The daily note could not be opened.");
        } finally {
            if (!controller.signal.aborted) setOpeningDaily(false);
        }
    };

    const createEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEventTitle.trim()) return;
        const note = Note.new(newEventTitle.trim(), "", newEventType);
        await repositories.notes.save(note);
        dispatch.note(note);
        changeEventDate(null);
        navigate("/note/" + note.id);
    };

    const renderEvent = (event: CalendarEvent) => {
        const note = noteById.get(event.id);
        const noteType = note?.noteType ?? "note";
        return (
            <>
                <div className="text-sm font-semibold truncate">{event.title}</div>
                <div className="text-xs text-muted-foreground">{Dates.yearMonthDay(event.date)}</div>
                <div className="text-xs text-muted-foreground">{formatTime(event.date, locale)}</div>
                <span className="self-start px-2 py-0.5 rounded-full text-xs border">
                    {NOTE_TYPE_LABELS[noteType as NoteType]}
                </span>
            </>
        );
    };

    return (
        <div className="flex flex-col h-full p-4 gap-3">
            <PageCalendar
                defaultDate={parseJournalDay(searchParams.get("date")) ?? undefined}
                filters={filters}
                events={calendarEvents}
                onAddEvent={onAddEvent}
                onSlotClick={changeEventDate}
                renderEvent={renderEvent}
                onEventClick={onEventClick}
                onChangeFilters={setFilters}
            />
            <Modal
                title="New note"
                className="max-w-md"
                open={createEventDate !== null}
                onChange={() => changeEventDate(null)}
            >
                <form onSubmit={createEvent} className="flex flex-col gap-4">
                    <Button type="button" theme="muted" disabled={openingDaily} onClick={() => void openDailyNote()}>
                        {openingDaily ? "Opening daily note…" : "Open daily note"}
                    </Button>
                    {dailyError && <p role="alert" className="text-sm text-foreground">{dailyError}</p>}
                    {createEventDate && (
                        <p className="text-xs text-muted-foreground -mt-2">
                            {`${Dates.yearMonthDay(createEventDate)} at ${formatTime(createEventDate, locale)}`}
                        </p>
                    )}
                    <Input
                        required
                        autoFocus
                        value={newEventTitle}
                        id="new-event-title"
                        title="Title"
                        onChange={(e) => setNewEventTitle(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                        {CALENDAR_FILTERS.map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => setNewEventType(f.id as NoteType)}
                                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                                    newEventType === f.id ? "" : "border-border text-muted-foreground hover:bg-muted/30"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                        <Button theme="muted" type="button" onClick={() => changeEventDate(null)}>
                            Cancel
                        </Button>
                        <Button type="submit">Create</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
