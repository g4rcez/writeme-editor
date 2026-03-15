import { repositories, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";
import {
  Button,
  type CalendarEvent,
  type CalendarFilter,
  formatFullDate,
  formatTime,
  Input,
  Modal,
  PageCalendar,
  type TagProps,
  useLocale,
} from "@g4rcez/components";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const NOTE_TYPE_COLORS: Record<NoteType, string> = {
  "read-it-later": "bg-tag-info-bg text-tag-info-text",
  [NoteType.quick]: "bg-tag-warn-bg text-tag-warn-text",
  [NoteType.note]: "bg-tag-primary-bg text-tag-primary-text",
  [NoteType.json]: "bg-tag-secondary-bg text-tag-secondary-text",
  [NoteType.freehand]: "bg-tag-success-bg text-tag-success-text",
  [NoteType.template]: "bg-tag-danger-bg text-tag-danger-text",
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
    enabled: true,
  }),
);

export default function CalendarPage() {
  const locale = useLocale();
  const [state, dispatch] = useGlobalStore();
  const navigate = useNavigate();

  const [filters, setFilters] = useState<CalendarFilter[]>(CALENDAR_FILTERS);
  const [createEventDate, setCreateEventDate] = useState<Date | null>(null);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventType, setNewEventType] = useState<NoteType>(NoteType.note);

  useEffect(() => {
    if (createEventDate !== null) {
      setNewEventTitle("");
      setNewEventType(NoteType.note);
    }
  }, [createEventDate]);

  const activeFilterIds = useMemo(
    () => filters.filter((f) => f.enabled).map((f) => f.id),
    [filters],
  );

  const calendarEvents = useMemo<CalendarEvent[]>(
    () =>
      state.notes
        .filter((n) => activeFilterIds.includes(n.noteType))
        .map((note) => ({
          id: note.id,
          title: note.title,
          date: new Date(note.createdAt),
          filterId: note.noteType,
          className: NOTE_TYPE_COLORS[note.noteType],
        })),
    [state.notes, activeFilterIds],
  );

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

  const renderEvent = (event: CalendarEvent) => {
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
      <PageCalendar
        events={calendarEvents}
        filters={filters}
        onAddEvent={onAddEvent}
        onSlotClick={onSlotClick}
        onEventClick={onEventClick}
        onChangeFilters={setFilters}
        renderEvent={renderEvent}
      />

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
                {f.label}
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
