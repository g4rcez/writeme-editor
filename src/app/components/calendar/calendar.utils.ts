import {
  addDays,
  startOfMonth,
  startOfWeek,
  getISOWeek,
} from "date-fns";
import type { CalendarEvent } from "./calendar.types";

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = toDateKey(event.date);
    const existing = map.get(key);
    if (existing) {
      existing.push(event);
    } else {
      map.set(key, [event]);
    }
  }
  return map;
}

export function getMonthDays(date: Date): Date[] {
  const monthStart = startOfMonth(date);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(addDays(gridStart, i));
  }
  return days;
}

export function getWeekDays(date: Date): Date[] {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDays(weekStart, i));
  }
  return days;
}

export function getHourSlots(): number[] {
  return Array.from({ length: 24 }, (_, i) => i);
}

export function formatEventTime(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(date));
}

export function formatDay(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric" }).format(date);
}

export function formatWeekdayLong(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
}

export function formatWeekdayShort(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
}

export function formatMonthYear(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
}

export function formatMonthShort(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
}

export function formatHourLabel(hour: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(0, 0, 0, hour));
}

export function formatFullDate(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "long", month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function formatTime(date: Date, locale?: string): string {
  const fmt = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
  return fmt.format(date);
}

export function getWeekNumber(date: Date): number {
  return getISOWeek(date);
}
