import { globalDispatch } from "@/store/global.store";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";
import { repairedMarkdown, requestNoteLinkRepair } from "./note-link-repair";
import { findCompatibleNotes, getNoteAliases } from "./note-lookup";

const creations = new Map<string, Promise<Note>>();

export async function refreshConnectionNotes(): Promise<void> {
    globalDispatch.notes(await repositories.notes.getAll());
}

export function createConnectionTarget(title: string): Promise<Note> {
    const key = title.trim().normalize("NFC").toLowerCase();
    const pending = creations.get(key);
    if (pending) return pending;
    const creation = (async (): Promise<Note> => {
        const notes = await repositories.notes.getAll();
        const matches = findCompatibleNotes(notes, title);
        if (matches.length > 1) throw new Error("More than one matching note exists. Choose an existing note.");
        let note = matches[0];
        if (!note) {
            note = Note.new(title.trim().replace(/\.md$/i, ""), "");
            await repositories.notes.save(note);
        }
        globalDispatch.notes(await repositories.notes.getAll());
        return note;
    })().finally(() => creations.delete(key));
    creations.set(key, creation);
    return creation;
}

export type ConnectionRepair = {
    source: Note;
    target: Note;
    from: number;
    to: number;
    replacement: string;
};

export async function applyConnectionRepair(repair: ConnectionRepair): Promise<Note | null> {
    const target = await repositories.notes.getOne(repair.target.id);
    if (
        !target ||
        target.title !== repair.target.title ||
        target.filePath !== repair.target.filePath ||
        JSON.stringify(getNoteAliases(target)) !== JSON.stringify(getNoteAliases(repair.target))
    ) {
        globalDispatch.notes(await repositories.notes.getAll());
        throw new Error("The target note changed or was deleted. Review the refreshed suggestions.");
    }
    const request = { noteId: repair.source.id, expectedContent: repair.source.content, ...repair };
    const updated = repairedMarkdown(repair.source.content, request);
    if (updated === null) throw new Error("This occurrence is no longer available. Refresh the suggestions.");
    const source = await repositories.notes.getOne(repair.source.id);
    if (!source || source.title !== repair.source.title || source.content !== repair.source.content) {
        globalDispatch.notes(await repositories.notes.getAll());
        throw new Error("The source note changed or was deleted. Review the refreshed suggestions before linking.");
    }
    const result = requestNoteLinkRepair(request);
    if (result === "conflict")
        throw new Error("This note has unsaved changes. Save it, then preview the refreshed suggestion.");
    if (result === "unavailable")
        throw new Error("The source editor is read-only or unavailable. Reopen the note and try again.");
    if (result === "applied") return null;
    const saved = await repositories.notes.updateContentIfUnchanged(source.id, source, updated);
    if (!saved) {
        globalDispatch.notes(await repositories.notes.getAll());
        throw new Error("The source note changed. Review the refreshed suggestion before linking.");
    }
    await globalDispatch.syncNoteFromRepository(saved);
    return saved;
}

export async function undoConnectionRepair(saved: Note, originalContent: string): Promise<void> {
    const restored = await repositories.notes.updateContentIfUnchanged(saved.id, saved, originalContent);
    if (!restored) throw new Error("The source note changed after linking. Open it to review your changes.");
    await globalDispatch.syncNoteFromRepository(restored);
}
