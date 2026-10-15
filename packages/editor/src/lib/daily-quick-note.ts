import { startOfDay } from "date-fns";
import { Dates } from "@/lib/dates";
import { isElectron } from "@/lib/is-electron";
import { getJournalDate, parseJournalDay } from "@/lib/journal-date";
import { getDailyQuickNotePath, getDailyQuickNoteTitle } from "@/lib/quicknote-utils";
import { Note, NoteType } from "@/store/note";
import { repositories } from "@/store/repositories";
import { SettingsService } from "@/store/settings";

type DailyQuickNoteOptions = {
    title?: string;
    content?: string;
};

const pendingNotes = new Map<string, Promise<Note>>();

async function getExistingElectronNote(filePath: string, day: Date): Promise<Note | null> {
    const existingMetadata = await window.electronAPI.db.notes.getByFilePath(filePath);
    if (existingMetadata) {
        const existing = await repositories.notes.getOne(existingMetadata.id);
        if (!existing) {
            throw new Error("The existing daily quick note could not be read. It was not changed.");
        }
        return existing;
    }

    const statResult = await window.electronAPI.fs.statFile(filePath);
    if (!statResult.success) throw new Error("Failed to check the daily quick note.");
    if (!statResult.exists) return null;

    const readResult = await window.electronAPI.fs.readFile(filePath);
    if (!readResult.success || typeof readResult.content !== "string") {
        throw new Error("The existing daily quick note could not be read. It was not changed.");
    }

    const note = Note.new(getDailyQuickNoteTitle(day), readResult.content, NoteType.quick);
    note.metadata.journalDate = Dates.isoDate(day);
    note.setFilePath(filePath, readResult.lastModified ? new Date(readResult.lastModified) : new Date());
    note.fileSize = typeof readResult.fileSize === "number" ? readResult.fileSize : readResult.content.length;
    await repositories.notes.save(note);
    return note;
}

async function findExistingDailyQuickNote(
    day: Date,
    settings: ReturnType<typeof SettingsService.load>,
    useDesktopWorkspace: boolean,
): Promise<Note | null> {
    let existing = await repositories.notes.getQuicknoteByDate(day);
    if (!existing && useDesktopWorkspace && settings.directory) {
        existing = await getExistingElectronNote(getDailyQuickNotePath(settings.directory, day), day);
    }
    if (
        existing &&
        !parseJournalDay(typeof existing.metadata.journalDate === "string" ? existing.metadata.journalDate : null)
    ) {
        const journalDate = getJournalDate(existing);
        if (journalDate) {
            const metadata = { ...existing.metadata, journalDate: Dates.isoDate(journalDate) };
            await repositories.notes.updateMetadata(existing.id, metadata);
            existing.metadata = metadata;
        }
    }
    return existing;
}

export async function getExistingDailyQuickNote(date: Date): Promise<Note | null> {
    const day = startOfDay(date);
    const settings = SettingsService.load();
    const useDesktopWorkspace = isElectron() && Boolean(settings.directory);
    return findExistingDailyQuickNote(day, settings, useDesktopWorkspace);
}

async function createDailyQuickNote(
    day: Date,
    options: DailyQuickNoteOptions,
    settings: ReturnType<typeof SettingsService.load>,
    useDesktopWorkspace: boolean,
): Promise<Note> {
    const title = options.title?.trim() || getDailyQuickNoteTitle(day);
    const content = options.content ?? "";

    if (useDesktopWorkspace && settings.directory) {
        const filePath = getDailyQuickNotePath(settings.directory, day);
        const existing = await findExistingDailyQuickNote(day, settings, useDesktopWorkspace);
        if (existing) return existing;

        const fileResult = await window.electronAPI.fs.writeFile(filePath, content);
        if (!fileResult.success) throw new Error("Failed to create the daily quick note.");

        const note = Note.new(title, content, NoteType.quick);
        note.metadata.journalDate = Dates.isoDate(day);
        note.setFilePath(filePath, fileResult.lastModified ? new Date(fileResult.lastModified) : new Date());
        note.fileSize = typeof fileResult.fileSize === "number" ? fileResult.fileSize : content.length;
        await repositories.notes.save(note);
        return note;
    }

    const dayNote = await findExistingDailyQuickNote(day, settings, useDesktopWorkspace);
    if (dayNote) return dayNote;

    const note = Note.new(title, content, NoteType.quick);
    note.metadata.journalDate = Dates.isoDate(day);
    await repositories.notes.save(note);
    return note;
}

export function getOrCreateDailyQuickNote(date: Date, options: DailyQuickNoteOptions = {}): Promise<Note> {
    const day = startOfDay(date);
    const settings = SettingsService.load();
    const useDesktopWorkspace = isElectron() && Boolean(settings.directory);
    const key =
        useDesktopWorkspace && settings.directory
            ? getDailyQuickNotePath(settings.directory, day)
            : `repository:${Dates.isoDate(day)}`;
    const pending = pendingNotes.get(key);
    if (pending) return pending;

    const request = createDailyQuickNote(day, options, settings, useDesktopWorkspace).finally(() => {
        if (pendingNotes.get(key) === request) pendingNotes.delete(key);
    });
    pendingNotes.set(key, request);
    return request;
}
