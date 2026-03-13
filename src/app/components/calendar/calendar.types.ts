import type { TagProps } from "@g4rcez/components";

export type ViewMode = "month" | "week" | "day";

export interface CalendarEvent {
  date: Date;
  id: string;
  title: string;
  className?: string;
}

export interface CalendarFilter {
  id: string;
  label: string;
  theme: TagProps["theme"];
}
