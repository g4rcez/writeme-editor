import { Dates } from "@/lib/dates";

function joinPath(...segments: string[]): string {
  return segments.join("/").replace(/\/+/g, "/").replace(/\/$/, "");
}

export function getDailyQuickNoteName(date: Date): string {
  return `${Dates.isoDate(date)}-quicknote`;
}

export function getDailyQuickNoteTitle(date: Date): string {
  return `${Dates.isoDate(date)}-QuickNote`;
}

export function getDailyQuickNotePath(directory: string, date: Date): string {
  return joinPath(directory, "quicknotes", `${getDailyQuickNoteName(date)}.md`);
}
