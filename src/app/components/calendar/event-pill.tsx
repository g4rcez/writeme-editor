import { Button, css } from "@g4rcez/components";
import type { CalendarEvent } from "./calendar.types";
import { formatEventTime } from "./calendar.utils";
import type { CSSProperties } from "react";

type EventPillProps = {
  compact?: boolean;
  onClick: () => void;
  event: CalendarEvent;
};

export function EventPill({ event, onClick, compact = false }: EventPillProps) {
  const props = {
    style: {
      border: "0",
      padding: "0 0.5rem",
      height: "1.25rem",
      borderRadius: "0.25rem",
    } as CSSProperties,
    className: css(
      "w-full border-0 justify-start rounded text-xs truncate text-ellipsis overflow-hidden border leading-tight",
      event.className,
    ),
  };
  if (compact) {
    return (
      <Button
        {...props}
        size="small"
        onClick={onClick}
        title={event.title}
        theme={event.className ? "raw" : "primary"}
      >
        {event.title}
      </Button>
    );
  }

  return (
    <Button
      {...props}
      size="small"
      onClick={onClick}
      title={event.title}
      theme={event.className ? "raw" : "primary"}
    >
      <div className="truncate font-medium">{event.title}</div>
      <div className="text-xs opacity-60">{formatEventTime(event.date)}</div>
    </Button>
  );
}
