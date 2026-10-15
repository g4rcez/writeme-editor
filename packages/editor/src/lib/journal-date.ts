import { Dates } from "@/lib/dates";
import { NoteType, type Note } from "@/store/note";

export function parseJournalDay(value: string | null): Date | null {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(0);
    date.setFullYear(year!, month! - 1, day!);
    date.setHours(0, 0, 0, 0);
    return Dates.isoDate(date) === value ? date : null;
}

export function getJournalDate(note: Note): Date | null {
    if (note.noteType !== NoteType.quick) return null;
    const explicit = typeof note.metadata.journalDate === "string" ? parseJournalDay(note.metadata.journalDate) : null;
    if (explicit) return explicit;
    const filename = (note.filePath ?? note.title).split(/[\\/]/).at(-1) ?? "";
    const filenameDay = filename.match(/^(\d{4}-\d{2}-\d{2})-quicknote(?:\.md)?$/)?.[1];
    return parseJournalDay(filenameDay ?? null) ?? new Date(note.createdAt);
}

export function findDailyQuickNote(notes: readonly Note[], date: Date): Note | null {
    const day = Dates.isoDate(date);
    return (
        notes.find((note) => {
            const journalDate = getJournalDate(note);
            return !note.deletedAt && journalDate !== null && Dates.isoDate(journalDate) === day;
        }) ?? null
    );
}
