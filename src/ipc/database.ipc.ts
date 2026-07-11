import { ipcMain } from "electron";
import { z } from "zod";
import { dbManager } from "../main-process/database";

const idSchema = z.string().min(1).max(1_024);
const pathSchema = z.string().min(1).max(32_768);
const dateSchema = z.iso.datetime();
const contentSchema = z.string().max(50_000_000);
const limitSchema = z.number().int().min(1).max(10_000);
const recordsSchema = z.array(z.unknown()).max(500);
const tabsSchema = z.array(z.object({ id: idSchema, order: z.number().int().safe() })).max(10_000);
const membersSchema = z.array(z.object({ id: idSchema, order: z.number().int().safe() })).max(10_000);
const tagsSchema = z.array(z.string().min(1).max(1_024)).max(10_000);

export const databaseIpcHandler = () => {
    const db = dbManager();

    ipcMain.handle("db:get", (_, table: string, id: string) => {
        return db.get(table, idSchema.parse(id));
    });

    ipcMain.handle("db:getAll", (_, table: string) => {
        return db.getAll(table);
    });

    ipcMain.handle("db:save", (_, table: string, item: unknown) => {
        return db.save(table, item);
    });

    ipcMain.handle("db:migrateCollection", (_, table: string, records: unknown[]) =>
        db.migrateCollection(table, recordsSchema.parse(records)),
    );

    ipcMain.handle("db:verifyCollection", (_, table: string, records: unknown[]) =>
        db.verifyCollection(table, recordsSchema.parse(records)),
    );

    ipcMain.handle("db:delete", (_, table: string, id: string) => {
        db.delete(table, idSchema.parse(id));
        return true;
    });

    ipcMain.handle("db:count", (_, table: string) => {
        return db.count(table);
    });

    // Specialized queries
    ipcMain.handle("db:notes:getLatestQuicknote", () => {
        return db.getLatestQuicknote();
    });

    ipcMain.handle("db:notes:getQuicknoteByDate", (_, start: string, end: string) => {
        return db.getQuicknoteByDate(dateSchema.parse(start), dateSchema.parse(end));
    });

    ipcMain.handle("db:notes:getRecentNotes", (_, limit: number, workspacePath: string | null) => {
        return db.getRecentNotes(limitSchema.parse(limit), pathSchema.nullable().parse(workspacePath));
    });

    ipcMain.handle("db:notes:getTemplates", () => {
        return db.getTemplates();
    });

    ipcMain.handle(
        "db:notes:updateContent",
        (_, id: string, content: string, fileSize: number, updatedAt: string, updatedBy: string) => {
            db.updateNoteContent(
                idSchema.parse(id),
                contentSchema.parse(content),
                z.number().int().nonnegative().safe().parse(fileSize),
                dateSchema.parse(updatedAt),
                z.string().max(1_024).parse(updatedBy),
            );
            return true;
        },
    );

    ipcMain.handle("db:tabs:updateOrder", (_, tabs: unknown) => {
        db.updateTabsOrder(tabsSchema.parse(tabs));
        return true;
    });

    ipcMain.handle("db:tabs:deleteByNoteId", (_, noteId: string) => {
        db.deleteTabsByNoteId(idSchema.parse(noteId));
        return true;
    });

    ipcMain.handle("db:hashtags:sync", (_, filename: string, tags: unknown) => {
        db.syncHashtags(pathSchema.parse(filename), tagsSchema.parse(tags));
        return true;
    });

    ipcMain.handle("db:noteGroups:getByNoteId", (_, noteId: string) => {
        return db.getNoteGroupsByNoteId(idSchema.parse(noteId));
    });

    ipcMain.handle("db:noteGroups:delete", (_, id: string) => {
        db.deleteNoteGroup(idSchema.parse(id));
        return true;
    });

    ipcMain.handle("db:noteGroupMembers:getByGroupId", (_, groupId: string) => {
        return db.getNoteGroupMembersByGroupId(idSchema.parse(groupId));
    });

    ipcMain.handle("db:noteGroupMembers:reorder", (_, members: unknown) => {
        db.reorderNoteGroupMembers(membersSchema.parse(members));
        return true;
    });

    ipcMain.handle("db:noteGroupMembers:deleteByNoteId", (_, noteId: string) => {
        db.deleteNoteGroupMembersByNoteId(idSchema.parse(noteId));
        return true;
    });

    ipcMain.handle("db:noteGroupMembers:deleteByGroupId", (_, groupId: string) => {
        db.deleteNoteGroupMembersByGroupId(idSchema.parse(groupId));
        return true;
    });

    ipcMain.handle("db:notes:getByFilePath", (_, filePath: string) => {
        return db.getNoteByFilePath(pathSchema.parse(filePath));
    });

    ipcMain.handle("db:notes:softDelete", (_, id: string, deletedAt: string) => {
        db.softDeleteNote(idSchema.parse(id), dateSchema.parse(deletedAt));
        return true;
    });

    ipcMain.handle("db:notes:hardDelete", (_, id: string) => {
        db.hardDeleteNote(idSchema.parse(id));
        return true;
    });

    ipcMain.handle("db:notes:restore", (_, id: string) => {
        db.restoreNote(idSchema.parse(id));
        return true;
    });

    ipcMain.handle("db:notes:getTrashed", () => {
        return db.getTrashedNotes();
    });

    ipcMain.handle("db:notes:emptyTrash", () => {
        db.emptyTrash();
        return true;
    });

    ipcMain.handle("db:notes:purgeBefore", (_, cutoff: string) => {
        db.purgeTrashedNotesBefore(dateSchema.parse(cutoff));
        return true;
    });

    ipcMain.handle(
        "db:notes:moveToTrash",
        (_, id: string, trashPath: string, originalFilePath: string | null, deletedAt: string) => {
            db.moveNoteToTrash(
                idSchema.parse(id),
                pathSchema.parse(trashPath),
                pathSchema.nullable().parse(originalFilePath),
                dateSchema.parse(deletedAt),
            );
            return true;
        },
    );

    ipcMain.handle("db:notes:restoreFromTrash", (_, id: string) => {
        db.restoreNoteFromTrash(idSchema.parse(id));
        return true;
    });
};
