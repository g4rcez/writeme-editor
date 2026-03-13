import { CalendarHeader } from "@/app/components/calendar/calendar-header";
import {
  type CalendarEvent,
  type CalendarFilter,
  type ViewMode,
} from "@/app/components/calendar/calendar.types";
import {
  formatFullDate,
  formatTime,
  getMonthDays,
  getWeekDays,
  groupEventsByDate,
} from "@/app/components/calendar/calendar.utils";
import { DayView } from "@/app/components/calendar/day-view";
import { MonthView } from "@/app/components/calendar/month-view";
import { WeekView } from "@/app/components/calendar/week-view";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";
import {
  Button,
  Input,
  Modal,
  useLocale,
  type TagProps,
} from "@g4rcez/components";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const NOTE_TYPE_COLORS: Record<NoteType, string> = {
  "read-it-later": "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  [NoteType.quick]: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  [NoteType.note]: "bg-primary/20 text-primary",
  [NoteType.json]: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
  [NoteType.freehand]: "bg-green-500/20 text-green-700 dark:text-green-300",
  [NoteType.template]: "bg-red-500/20 text-red-700 dark:text-red-300",
};

const NOTE_TYPE_FILTER_THEMES: Record<NoteType, TagProps["theme"]> = {
  "read-it-later": "info",
  [NoteType.quick]: "warn",
  [NoteType.note]: "primary",
  [NoteType.json]: "secondary",
  [NoteType.freehand]: "success",
  [NoteType.template]: "danger",
};

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  note: "Note",
  quick: "Quick",
  "read-it-later": "Read Later",
  template: "Template",
  json: "JSON",
  freehand: "Freehand",
};

const CALENDAR_FILTERS: CalendarFilter[] = Object.values(NoteType).map(
  (type) => ({
    id: type,
    label: NOTE_TYPE_LABELS[type],
    theme: NOTE_TYPE_FILTER_THEMES[type],
  }),
);

export default function CalendarPage() {
  const locale = useLocale();
  const [state, dispatch] = useGlobalStore();
  const navigate = useNavigate();

  const [currentView, setCurrentView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [activeFilters, setActiveFilters] = useState<string[]>(
    CALENDAR_FILTERS.map((f) => f.id),
  );
  const [createEventDate, setCreateEventDate] = useState<Date | null>(null);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventType, setNewEventType] = useState<NoteType>(NoteType.note);

  useEffect(() => {
    if (createEventDate !== null) {
      setNewEventTitle("");
      setNewEventType(NoteType.note);
    }
  }, [createEventDate]);

  const filteredNotes = useMemo(
    () => state.notes.filter((n) => activeFilters.includes(n.noteType)),
    [state.notes, activeFilters],
  );

  const calendarEvents = useMemo<CalendarEvent[]>(
    () =>
      filteredNotes.map((note) => ({
        id: note.id,
        title: note.title,
        date: new Date(note.createdAt),
        className: NOTE_TYPE_COLORS[note.noteType],
      })),
    [filteredNotes],
  );

  const eventsByDate = useMemo(
    () => groupEventsByDate(calendarEvents),
    [calendarEvents],
  );

  const monthDays = useMemo(() => getMonthDays(currentDate), [currentDate]);
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const noteById = useMemo(
    () => new Map(state.notes.map((n) => [n.id, n])),
    [state.notes],
  );

  const onEventClick = (event: CalendarEvent) => {
    dispatch.selectNoteById(event.id);
    navigate("/note/" + event.id);
  };

  const onAddEvent = () => {
    dispatch.setCreateNoteDialog({ isOpen: true, type: "note" });
  };

  const onSlotClick = (date: Date) => setCreateEventDate(date);

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;
    const note = Note.new(newEventTitle.trim(), "", newEventType);
    await repositories.notes.save(note);
    dispatch.note(note);
    setCreateEventDate(null);
    navigate("/note/" + note.id);
  };

  const onDayClick = (date: Date) => {
    setCurrentDate(date);
    setCurrentView("day");
  };

  const renderEventDetail = (event: CalendarEvent) => {
    const note = noteById.get(event.id);
    const noteType = note?.noteType ?? "note";
    return (
      <>
        <div className="text-sm font-semibold truncate">{event.title}</div>
        <div className="text-xs text-muted-foreground">
          {formatFullDate(event.date, locale)}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatTime(event.date, locale)}
        </div>
        <span className="self-start px-2 py-0.5 rounded-full text-xs border">
          {NOTE_TYPE_LABELS[noteType as NoteType]}
        </span>
      </>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 gap-3">
      <CalendarHeader
        onAddEvent={onAddEvent}
        currentDate={currentDate}
        currentView={currentView}
        filters={CALENDAR_FILTERS}
        activeFilters={activeFilters}
        setCurrentDate={setCurrentDate}
        setCurrentView={setCurrentView}
        setActiveFilters={setActiveFilters}
      />
      {currentView === "month" && (
        <MonthView
          days={monthDays}
          onDayClick={onDayClick}
          currentDate={currentDate}
          eventsByDate={eventsByDate}
          onEventClick={onEventClick}
        />
      )}

      {currentView === "week" && (
        <WeekView
          days={weekDays}
          eventsByDate={eventsByDate}
          currentDate={currentDate}
          onEventClick={onEventClick}
          onSlotClick={onSlotClick}
        />
      )}

      {currentView === "day" && (
        <DayView
          currentDate={currentDate}
          eventsByDate={eventsByDate}
          onEventClick={onEventClick}
          onDateChange={setCurrentDate}
          renderEventDetail={renderEventDetail}
          onSlotClick={onSlotClick}
        />
      )}

      <Modal
        open={createEventDate !== null}
        className="max-w-md"
        onChange={() => setCreateEventDate(null)}
        title="New note"
      >
        <form onSubmit={createEvent} className="flex flex-col gap-4">
          {createEventDate && (
            <p className="text-xs text-muted-foreground -mt-2">
              {`${formatFullDate(createEventDate, locale)} at ${formatTime(createEventDate, locale)}`}
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
                  newEventType === f.id
                    ? ""
                    : "border-border text-muted-foreground hover:bg-muted/30"
                }`}
              >
                -- {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              theme="muted"
              type="button"
              onClick={() => setCreateEventDate(null)}
            >
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
