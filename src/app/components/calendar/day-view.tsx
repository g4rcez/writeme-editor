import { isSameDay, isToday } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { Tag, useLocale } from "@g4rcez/components";
import type { CalendarEvent } from "./calendar.types";
import { EventPill } from "./event-pill";
import {
  getHourSlots,
  getMonthDays,
  toDateKey,
  formatDay,
  formatWeekdayLong,
  formatMonthYear,
  formatHourLabel,
  formatFullDate,
  formatTime,
} from "./calendar.utils";

const HOUR_HEIGHT = 48;

function getTopOffset(event: CalendarEvent): number {
  const hour = event.date.getHours();
  const minutes = event.date.getMinutes();
  return hour * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
}

type DayViewProps = {
  currentDate: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  onEventClick: (event: CalendarEvent) => void;
  onDateChange: (date: Date) => void;
  renderEventDetail?: (event: CalendarEvent) => React.ReactNode;
  onSlotClick?: (date: Date) => void;
};

const MINI_WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function DayView({
  currentDate,
  eventsByDate,
  onEventClick,
  onDateChange,
  renderEventDetail,
  onSlotClick,
}: DayViewProps) {
  const locale = useLocale();
  const currentHourRef = useRef<HTMLDivElement>(null);
  const hours = getHourSlots();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    if (currentHourRef.current) {
      currentHourRef.current.scrollIntoView({ block: "center" });
    }
  }, []);

  const dayKey = toDateKey(currentDate);
  const events = eventsByDate.get(dayKey) || [];

  const miniDays = getMonthDays(currentDate);

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    onEventClick(event);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: timeline */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Day header */}
        <div className="border-b border-border py-2 px-4 flex items-center gap-3 flex-shrink-0">
          <span
            className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
              isToday(currentDate)
                ? "bg-primary text-primary-foreground"
                : "text-foreground"
            }`}
          >
            {formatDay(currentDate, locale)}
          </span>
          <div>
            <div className="font-semibold">{formatWeekdayLong(currentDate, locale)}</div>
            <div className="text-xs text-muted-foreground">
              {formatMonthYear(currentDate, locale)}
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-y-auto items-start">
          {/* Time gutter */}
          <div className="w-[60px] flex-shrink-0">
            {hours.map((hour) => (
              <div
                key={hour}
                className="relative"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-2.5 right-2 text-[10px] text-muted-foreground">
                  {hour === 0 ? "" : formatHourLabel(hour, locale)}
                </span>
                {hour === new Date().getHours() && (
                  <div ref={currentHourRef} />
                )}
              </div>
            ))}
          </div>

          {/* Events column */}
          <div className="flex-1 relative border-l border-card-border">
            {hours.map((hour) => {
              const slotDate = new Date(currentDate);
              slotDate.setHours(hour, 0, 0, 0);
              return (
                <div
                  key={hour}
                  className="border-b border-border/50 cursor-pointer hover:bg-muted/20"
                  style={{ height: HOUR_HEIGHT }}
                  onClick={() => onSlotClick?.(slotDate)}
                />
              );
            })}
            {events.map((event) => (
              <div
                key={event.id}
                className="absolute left-1 right-1"
                style={{ top: getTopOffset(event), height: HOUR_HEIGHT }}
                onClick={(e) => e.stopPropagation()}
              >
                <EventPill
                  event={event}
                  onClick={() => handleEventClick(event)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-72 border-l border-card-border flex flex-col overflow-y-auto">
        {/* Mini calendar */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold">
              {formatMonthYear(currentDate, locale)}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {MINI_WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="text-center text-[10px] text-muted-foreground font-medium"
              >
                {wd}
              </div>
            ))}
            {miniDays.map((day, idx) => {
              const key = toDateKey(day);
              const hasEvents = (eventsByDate.get(key) || []).length > 0;
              const isSelected = isSameDay(day, currentDate);
              const isCurrentDay = isToday(day);
              return (
                <button
                  key={idx}
                  onClick={() => onDateChange(day)}
                  className={`relative flex flex-col items-center justify-center w-7 h-7 rounded-full text-xs mx-auto transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isCurrentDay
                        ? "bg-primary/20 text-primary"
                        : "hover:bg-muted/50 text-foreground"
                  }`}
                >
                  {formatDay(day, locale)}
                  {hasEvents && !isSelected && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected event detail */}
        {selectedEvent && (
          <div className="p-3 flex flex-col gap-2">
            {renderEventDetail ? (
              renderEventDetail(selectedEvent)
            ) : (
              <>
                <div className="text-sm font-semibold truncate">
                  {selectedEvent.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatFullDate(selectedEvent.date, locale)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatTime(selectedEvent.date, locale)}
                </div>
                <Tag theme={selectedEvent.className ? "custom" : "primary"} size="small" className={`self-start${selectedEvent.className ? ` ${selectedEvent.className}` : ""}`} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
