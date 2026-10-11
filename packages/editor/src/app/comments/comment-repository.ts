import type { CommentSourceUpdate, CommentSaveResult } from "@/store/note-comment";
import { isElectron } from "@/lib/is-electron";
import {
    getCommentCompanion,
    getCommentReferenceHref,
    appendNoteComment,
    parseCommentThreads,
    uniqueCommentId,
} from "@/lib/note-comments";
import { getStorageMode } from "@/lib/storage-mode";
import { Note } from "@/store/note";
import { repositories } from "@/store/repositories";
import { SettingsService } from "@/store/settings";

const pending = new Map<string, Promise<unknown>>();
const incompleteWrites = new Map<string, { result: CommentSaveResult; previousContent: string | null }>();

export async function loadCommentNote(source: Note): Promise<Note | null> {
    if (!isElectron()) {
        const { loadBrowserCommentNote } = await import("@/store/repositories/browser/comments.repository");
        return loadBrowserCommentNote(source);
    }
    const companion = getCommentCompanion(source);
    const notes = await repositories.notes.getAll();
    const existing =
        notes.find((note) => !note.deletedAt && note.metadata?.commentSourceId === source.id) ??
        notes.find(
            (note) =>
                !note.deletedAt &&
                (companion.filePath
                    ? note.filePath?.replaceAll("\\", "/") === companion.filePath
                    : note.project === source.project &&
                      (note.metadata.commentSourceId === source.id || note.title === companion.title)),
        );
    if (existing) return repositories.notes.getOne(existing.id);
    if (companion.filePath && getStorageMode(SettingsService.load().directory) === "filesystem") {
        const stat = await window.electronAPI.fs.statFile(companion.filePath);
        if (!stat.success) throw new Error(stat.error || "Could not access comments note.");
        if (stat.exists) {
            const file = await window.electronAPI.fs.readFile(companion.filePath);
            if (!file.success) throw new Error(file.error || "Could not read comments note.");
            const note = Note.parse({
                ...Note.new(companion.title, file.content),
                project: source.project,
                filePath: companion.filePath,
                lastSynced: new Date(file.lastModified),
                metadata: { commentSourceId: source.id },
            });
            return repositories.notes.save(note);
        }
    }
    return null;
}

export async function saveNoteComment(
    source: Note,
    quote: string,
    body: string,
    threadId: string | null,
    usedIds: string[],
    prepareSource?: CommentSourceUpdate,
    operationId?: string,
): Promise<CommentSaveResult> {
    if (!body.trim()) throw new Error("Write a comment before saving.");
    if (!isElectron()) {
        const { saveBrowserNoteComment } = await import("@/store/repositories/browser/comments.repository");
        return saveBrowserNoteComment(source, quote, body, threadId, usedIds, prepareSource);
    }
    const companion = getCommentCompanion(source);
    const key = companion.filePath ?? `${source.project}:${companion.title}`;
    const previous = pending.get(key) ?? Promise.resolve();
    const operation = previous
        .catch(() => undefined)
        .then(async () => {
            const incomplete = operationId ? incompleteWrites.get(operationId) : undefined;
            if (incomplete?.result.note.filePath) {
                const file = await window.electronAPI.fs.readFile(incomplete.result.note.filePath);
                if (!file.success) throw new Error(file.error || "Could not recover the comments note.");
                if (file.content === incomplete.result.note.content) {
                    await repositories.notes.save(incomplete.result.note);
                    incompleteWrites.delete(operationId!);
                    return incomplete.result;
                }
                if (file.content !== incomplete.previousContent)
                    throw new Error("The comments note changed after a partial save. Reload it before retrying.");
                incompleteWrites.delete(operationId!);
            }
            const existing = await loadCommentNote(source);
            const id =
                threadId ??
                uniqueCommentId(quote, [
                    ...usedIds,
                    ...parseCommentThreads(existing?.content ?? "").map((thread) => thread.id),
                ]);
            const initial = `# ${companion.title}\n\nSource: [${source.title.replace(/[[\]\\]/g, "\\$&")}](${
                source.filePath
                    ? `./${encodeURIComponent(source.filePath.replaceAll("\\", "/").split("/").pop() ?? "")}`
                    : `/note/${source.id}`
            })\n`;
            const content = appendNoteComment(existing?.content ?? initial, id, quote, body);
            const remember = (note: Note): void => {
                if (!operationId || !note.filePath) return;
                if (incompleteWrites.size >= 25) incompleteWrites.delete(incompleteWrites.keys().next().value!);
                incompleteWrites.set(operationId, {
                    result: { note, id, href: getCommentReferenceHref(note) },
                    previousContent: existing?.content ?? null,
                });
            };
            if (existing) {
                remember(Note.parse({ ...existing, content, updatedAt: new Date(), fileSize: content.length }));
                const updated = await repositories.notes.updateContentIfUnchanged(
                    existing.id,
                    {
                        title: existing.title,
                        updatedAt: existing.updatedAt,
                        content: existing.content,
                    },
                    content,
                );
                if (!updated) {
                    if (operationId) incompleteWrites.delete(operationId);
                    throw new Error("The comments note changed. Try saving your comment again.");
                }
                if (operationId) incompleteWrites.delete(operationId);
                return { note: updated, id, href: getCommentReferenceHref(updated) };
            }
            const note = Note.parse({
                ...Note.new(companion.title, content),
                project: source.project,
                metadata: { commentSourceId: source.id },
            });
            if (companion.filePath && getStorageMode(SettingsService.load().directory) === "filesystem") {
                const stat = await window.electronAPI.fs.statFile(companion.filePath);
                if (!stat.success || stat.exists)
                    throw new Error("The comments note changed. Try saving your comment again.");
                const written = await window.electronAPI.fs.createFile(companion.filePath, content);
                if (!written.success) throw new Error(written.error || "Could not save comments note.");
                note.filePath = companion.filePath;
                note.fileSize = written.fileSize ?? content.length;
                note.lastSynced = written.lastModified ? new Date(written.lastModified) : new Date();
                remember(note);
            }
            await repositories.notes.save(note);
            if (operationId) incompleteWrites.delete(operationId);
            return { note, id, href: getCommentReferenceHref(note) };
        });
    pending.set(key, operation);
    try {
        return await operation;
    } finally {
        if (pending.get(key) === operation) pending.delete(key);
    }
}
