import { isToday } from "date-fns";
import { useEffect, useRef } from "react";
import { useLocale } from "@g4rcez/components";
import type { CalendarEvent } from "./calendar.types";
import { EventPill } from "./event-pill";
import { getHourSlots, toDateKey, formatWeekdayShort, formatDay, formatHourLabel } from "./calendar.utils";

const HOUR_HEIGHT = 48;

type WeekViewProps = {
  days: Date[];
  eventsByDate: Map<string, CalendarEvent[]>;
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick?: (date: Date) => void;
};

function getTopOffset(event: CalendarEvent): number {
  const hour = event.date.getHours();
  const minutes = event.date.getMinutes();
  return hour * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
}

export function WeekView({
  days,
  eventsByDate,
  onEventClick,
  onSlotClick,
}: WeekViewProps) {
  const locale = useLocale();
  const currentHourRef = useRef<HTMLDivElement>(null);
  const hours = getHourSlots();

  useEffect(() => {
    if (currentHourRef.current) {
      currentHourRef.current.scrollIntoView({ block: "center" });
    }
  }, []);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header row */}
      <div className="flex border-b border-border flex-shrink-0">
        <div className="w-[60px] flex-shrink-0" />
        {days.map((day, idx) => {
          const isCurrentDay = isToday(day);
          return (
            <div
              key={idx}
              className="flex-1 text-center py-2 text-xs font-medium text-muted-foreground"
            >
              <span className="block">{formatWeekdayShort(day, locale)}</span>
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold ${
                  isCurrentDay
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground"
                }`}
              >
                {formatDay(day, locale)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Body */}
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

        {/* Day columns */}
        {days.map((day, dayIdx) => {
          const key = toDateKey(day);
          const events = eventsByDate.get(key) || [];
          return (
            <div
              key={dayIdx}
              className="flex-1 relative border-l border-card-border"
            >
              {hours.map((hour) => {
                const slotDate = new Date(day);
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
                  className="absolute left-0.5 right-0.5"
                  style={{
                    top: getTopOffset(event),
                    height: HOUR_HEIGHT,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <EventPill event={event} onClick={() => onEventClick(event)} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
