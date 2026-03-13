import { isSameMonth, isToday } from "date-fns";
import { useLocale } from "@g4rcez/components";
import type { CalendarEvent } from "./calendar.types";
import { EventPill } from "./event-pill";
import { toDateKey, formatDay } from "./calendar.utils";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type MonthViewProps = {
  days: Date[];
  currentDate: Date;
  onDayClick: (date: Date) => void;
  eventsByDate: Map<string, CalendarEvent[]>;
  onEventClick: (event: CalendarEvent) => void;
};

export function MonthView({
  days,
  eventsByDate,
  currentDate,
  onEventClick,
  onDayClick,
}: MonthViewProps) {
  const locale = useLocale();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_LABELS.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto">
        {days.map((day, idx) => {
          const key = toDateKey(day);
          const events = eventsByDate.get(key) || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);
          const visible = events.slice(0, 2);
          const overflow = events.length - 2;

          return (
            <div
              key={idx}
              className={`group min-h-[120px] border-r border-b border-border p-2 flex flex-col gap-1 cursor-pointer hover:bg-muted/10 transition-colors ${
                !isCurrentMonth ? "opacity-40" : ""
              }`}
              onClick={() => onDayClick(day)}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                    isCurrentDay
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                  }`}
                >
                  {formatDay(day, locale)}
                </span>
                <span className="opacity-0 group-hover:opacity-40 text-muted-foreground text-lg leading-none transition-opacity">
                  +
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                {visible.map((event) => (
                  <div key={event.id} onClick={(e) => e.stopPropagation()}>
                    <EventPill
                      compact
                      event={event}
                      onClick={() => onEventClick(event)}
                    />
                  </div>
                ))}
                {overflow > 0 && (
                  <span className="text-xs text-muted-foreground pl-1">
                    +{overflow} more...
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
