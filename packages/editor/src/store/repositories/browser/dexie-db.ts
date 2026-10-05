import Dexie, { type EntityTable, type Transaction } from "dexie";
import { v7 as uuid } from "uuid";
import type { Note } from "../../note";
import type { NoteSnapshot } from "../../note-history";
import type { AIChat, AIConfig, AIMessage } from "../electron/ai.repository";
import type { AICredentials } from "../entities/ai";
import type { CursorPosition } from "../entities/cursor-position";
import type { Hashtag } from "../entities/hashtag";
import type { NoteGroup } from "../entities/note-group";
import type { NoteGroupMember } from "../entities/note-group-member";
import type { Project } from "../entities/project";
import type { Script } from "../entities/script";
import type { Settings } from "../entities/settings";
import type { Tab } from "../entities/tab";
import type { TerminalSession } from "../entities/terminal-session";
import type { View } from "../entities/view";
type LegacyTemplate = {
    id?: unknown;
    name?: unknown;
    content?: unknown;
    [key: string]: unknown;
};

function areEqualValues(left: unknown, right: unknown): boolean {
    if (left === right) return true;
    if (left instanceof Date || right instanceof Date) {
        return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
    }
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
            left.every((value, index) => areEqualValues(value, right[index]));
    }
    if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    return leftKeys.length === rightKeys.length &&
        leftKeys.every((key) => Object.hasOwn(rightRecord, key) && areEqualValues(leftRecord[key], rightRecord[key]));
}


async function migrateLegacyProjects(tx: Transaction): Promise<void> {
    if (!tx.idbtrans.objectStoreNames.contains("project")) return;

    const request = tx.idbtrans.objectStore("project").getAll();
    const { promise, resolve, reject } = Promise.withResolvers<unknown[]>();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to read legacy projects."));
    const projects = await promise;

    for (const value of projects) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new Error("A legacy project could not be migrated; its source record was retained.");
        }
        const project = value as Record<string, unknown>;
        if (typeof project.id !== "string") {
            throw new Error("A legacy project is missing its ID; its source record was retained.");
        }
        const migratedProject = {
            ...project,
            folderPath: typeof project.folderPath === "string" ? project.folderPath : "",
        };
        const existing = await tx.table("projects").get(project.id);
        if (existing) {
            if (areEqualValues(migratedProject, existing)) continue;
            throw new Error(`Legacy project "${project.id}" conflicts with an existing project ID; source data was retained.`);
        }

        await tx.table("projects").add(migratedProject);
    }
}

async function migrateLegacyTemplates(tx: Transaction): Promise<void> {
    if (!tx.idbtrans.objectStoreNames.contains("templates")) return;

    const request = tx.idbtrans.objectStore("templates").getAll();
    const { promise, resolve, reject } = Promise.withResolvers<unknown[]>();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to read legacy templates."));
    const templates = await promise;

    for (const value of templates) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new Error("A legacy template could not be migrated; its source record was retained.");
        }
        const template = value as LegacyTemplate;
        if (typeof template.id !== "string" || typeof template.name !== "string" || typeof template.content !== "string") {
            throw new Error("A legacy template is missing required data; its source record was retained.");
        }

        const existing = await tx.table("notes").get(template.id);
        if (existing) {
            if (existing.noteType === "template" && existing.title === template.name && existing.content === template.content) {
                continue;
            }
            throw new Error(`Legacy template "${template.name}" conflicts with an existing note ID; source data was retained.`);
        }

        await tx.table("notes").add({
            ...template,
            type: "__writeme_note",
            id: template.id,
            title: template.name,
            content: template.content,
            filePath: typeof template.filePath === "string" ? template.filePath : null,
            noteType: "template",
            createdAt: template.createdAt ?? new Date(),
            updatedAt: template.updatedAt ?? new Date(),
            project: typeof template.project === "string" ? template.project : "",
            tags: Array.isArray(template.tags) ? template.tags : [],
            createdBy: typeof template.createdBy === "string" ? template.createdBy : "system",
            updatedBy: typeof template.updatedBy === "string" ? template.updatedBy : "system",
            fileSize: typeof template.fileSize === "number" ? template.fileSize : template.content.length,
            lastSynced: template.lastSynced ?? null,
            url: template.url ?? null,
            description: template.description ?? null,
            favicon: template.favicon ?? null,
            metadata:
                template.metadata && typeof template.metadata === "object" && !Array.isArray(template.metadata)
                    ? template.metadata
                    : {},
            favorite: typeof template.favorite === "boolean" ? template.favorite : false,
        });
    }
}

export const db = new Dexie("writeme") as Dexie & {
    notes: EntityTable<Note, "id">;
    noteHistory: EntityTable<NoteSnapshot, "id">;
    projects: EntityTable<Project, "id">;
    tabs: EntityTable<Tab, "id">;
    hashtags: EntityTable<Hashtag, "id">;
    settings: EntityTable<Settings, "id">;
    scripts: EntityTable<Script, "id">;
    noteGroups: EntityTable<NoteGroup, "id">;
    noteGroupMembers: EntityTable<NoteGroupMember, "id">;
    aiConfigs: EntityTable<AIConfig, "id">;
    aiChats: EntityTable<AIChat, "id">;
    aiMessages: EntityTable<AIMessage, "id">;
    aiCredentials: EntityTable<AICredentials, "adapterId">;
    views: EntityTable<View, "id">;
    cursorPositions: EntityTable<CursorPosition, "noteId">;
    terminalSessions: EntityTable<TerminalSession, "id">;
};
// Dexie deletes stores omitted from each version, so retain the original stores throughout upgrades.
const preservedLegacyStores = {
    project: "&id, title, description, *notes, createdAt, updatedAt",
    templates: "&id",
};

// Version 1 (original schema)
db.version(1).stores({
    ...preservedLegacyStores,
    notes: "&id, title, content, project, createdAt, updatedAt",
});

// Version 2 (hybrid storage - add metadata fields, content no longer indexed)
db.version(2)
    .stores({
        ...preservedLegacyStores,
        notes: "&id, title, project, filePath, *tags, createdAt, updatedAt, createdBy, updatedBy",
        projects: "&id, title, description, *notes, createdAt, updatedAt",
    })
    .upgrade(async (tx) => {
        const notes = await tx.table("notes").toArray();
        console.log(`Migrating ${notes.length} notes to schema v2...`);
        for (const note of notes) {
            await tx.table("notes").update(note.id, {
                filePath: null,
                fileSize: note.content?.length || 0,
                lastSynced: null,
                tags: [],
                createdBy: "system",
                updatedBy: "system",
            });
        }
        await migrateLegacyProjects(tx);
        console.log("Schema migration to v2 complete");
    });

db.version(3)
    .stores({
        ...preservedLegacyStores,
        notes: "&id, title, project, filePath, *tags, createdAt, updatedAt, createdBy, updatedBy",
        projects: "&id, title, folderPath, description, createdAt, updatedAt",
    })
    .upgrade(async (tx) => {
        const projects = await tx.table("projects").toArray();
        console.log(`Migrating ${projects.length} projects to schema v3...`);
        for (const project of projects) {
            await tx.table("projects").update(project.id, {
                folderPath: project.folderPath || "",
            });
        }
        console.log("Schema migration to v3 complete");
    });

// Version 4 (IndexedDB content support for web mode)
db.version(4)
    .stores({
        ...preservedLegacyStores,
        notes: "&id, title, project, filePath, *tags, createdAt, updatedAt, createdBy, updatedBy",
        projects: "&id, title, folderPath, description, createdAt, updatedAt",
    })
    .upgrade(async () => {
        console.log("Schema migration to v4 complete (IndexedDB content support)");
    });

// Version 5 (Tabs support)
db.version(5).stores({
    ...preservedLegacyStores,
    notes: "&id, title, project, filePath, *tags, createdAt, updatedAt, createdBy, updatedBy",
    projects: "&id, title, folderPath, description, createdAt, updatedAt",
    tabs: "&id, noteId, order, project, createdAt",
});

// Project values remain on existing records; only their indexes are retired.
db.version(6)
    .stores({
        ...preservedLegacyStores,
        notes: "&id, title, filePath, *tags, createdAt, updatedAt, createdBy, updatedBy",
        projects: "&id, title, folderPath, description, createdAt, updatedAt",
        tabs: "&id, noteId, order, createdAt",
    });

// Version 7 (Add noteType field for quicknotes support)
db.version(7)
    .stores({
        ...preservedLegacyStores,
        notes: "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy",
        projects: "&id, title, folderPath, description, createdAt, updatedAt",
        tabs: "&id, noteId, order, createdAt",
    })
    .upgrade(async (tx) => {
        console.log("Migrating to v7: adding noteType field...");
        const notes = await tx.table("notes").toArray();
        for (const note of notes) {
            await tx.table("notes").update(note.id, { noteType: "note" });
        }
        console.log("Schema migration to v7 complete");
    });

// Version 8 (Hashtags support)
db.version(8).stores({
    ...preservedLegacyStores,
    notes: "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy",
    projects: "&id, title, folderPath, description, createdAt, updatedAt",
    tabs: "&id, noteId, order, createdAt",
    hashtags: "&id, hashtag, filename, project",
});

// Version 9 (Settings support)
db.version(9)
    .stores({
        ...preservedLegacyStores,
        notes: "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy",
        projects: "&id, title, folderPath, description, createdAt, updatedAt",
        tabs: "&id, noteId, order, createdAt",
        hashtags: "&id, hashtag, filename, project",
        settings: "&id, &name, value",
    })
    .upgrade(async (tx) => {
        const defaults = [
            { name: "autosave", value: "true" },
            { name: "autosaveDelay", value: "5000" },
            { name: "theme", value: '"dark"' }, // JSON stringified string
        ];

        for (const def of defaults) {
            const exists = await tx.table("settings").where("name").equals(def.name).first();
            if (!exists) {
                await tx.table("settings").add({
                    id: uuid(),
                    name: def.name,
                    value: def.value,
                });
            }
        }
    });

// Version 11 (Favorite support)
db.version(11)
    .stores({
        ...preservedLegacyStores,
        notes: "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy, favorite",
        projects: "&id, title, folderPath, description, createdAt, updatedAt",
        tabs: "&id, noteId, order, createdAt",
        hashtags: "&id, hashtag, filename, project",
        settings: "&id, &name, value",
    })
    .upgrade(async (tx) => {
        console.log("Migrating to v11: adding favorite field to notes...");
        const notes = await tx.table("notes").toArray();
        for (const note of notes) {
            await tx.table("notes").update(note.id, { favorite: false });
        }
        console.log("Schema migration to v11 complete");
    });

// Version 15 (Copy legacy templates into notes; keep the source store)
db.version(15)
    .stores({
        ...preservedLegacyStores,
        notes: "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy, favorite",
        projects: "&id, title, folderPath, description, createdAt, updatedAt",
        tabs: "&id, noteId, order, createdAt",
        hashtags: "&id, hashtag, filename, project",
        settings: "&id, &name, value",
        scripts: "&id, name, createdAt, updatedAt",
    })
    .upgrade(migrateLegacyTemplates);
// Version 16 (Note groups)
db.version(16).stores({
    ...preservedLegacyStores,
    notes: "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy, favorite",
    projects: "&id, title, folderPath, description, createdAt, updatedAt",
    tabs: "&id, noteId, order, createdAt",
    hashtags: "&id, hashtag, filename, project",
    settings: "&id, &name, value",
    scripts: "&id, name, createdAt, updatedAt",
    noteGroups: "&id, title, createdAt, updatedAt",
    noteGroupMembers: "&id, groupId, noteId, order, createdAt",
});


db.version(17).stores({
    ...preservedLegacyStores,
    notes: "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy, favorite",
    projects: "&id, title, folderPath, description, createdAt, updatedAt",
    tabs: "&id, noteId, order, createdAt",
    hashtags: "&id, hashtag, filename, project",
    settings: "&id, &name, value",
    scripts: "&id, name, createdAt, updatedAt",
    noteGroups: "&id, title, createdAt, updatedAt",
    noteGroupMembers: "&id, groupId, noteId, order, createdAt",
    aiConfigs: "&id, adapterId, isDefault, createdAt",
    aiChats: "&id, noteId, createdAt",
    aiMessages: "&id, chatId, role, createdAt",
    aiCredentials: "&adapterId",
});

db.version(18).stores({
    ...preservedLegacyStores,
    notes: "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy, favorite",
    projects: "&id, title, folderPath, description, createdAt, updatedAt",
    tabs: "&id, noteId, order, createdAt",
    hashtags: "&id, hashtag, filename, project",
    settings: "&id, &name, value",
    scripts: "&id, name, createdAt, updatedAt",
    noteGroups: "&id, title, createdAt, updatedAt",
    noteGroupMembers: "&id, groupId, noteId, order, createdAt",
    aiConfigs: "&id, adapterId, isDefault, createdAt",
    aiChats: "&id, noteId, createdAt",
    aiMessages: "&id, chatId, role, createdAt",
    aiCredentials: "&adapterId",
    bases: "&id, title, viewType, createdAt, updatedAt",
});

db.version(19)
    .stores({
        ...preservedLegacyStores,
        notes: "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy, favorite",
        projects: "&id, title, folderPath, description, createdAt, updatedAt",
        tabs: "&id, noteId, order, createdAt",
        hashtags: "&id, hashtag, filename, project",
        settings: "&id, &name, value",
        scripts: "&id, name, createdAt, updatedAt",
        noteGroups: "&id, title, createdAt, updatedAt",
        noteGroupMembers: "&id, groupId, noteId, order, createdAt",
        aiConfigs: "&id, adapterId, isDefault, createdAt",
        aiChats: "&id, noteId, createdAt",
        aiMessages: "&id, chatId, role, createdAt",
        aiCredentials: "&adapterId",
        bases: "&id, title, viewType, createdAt, updatedAt",
        views: "&id, title, viewType, createdAt, updatedAt",
    })
    .upgrade(async (tx) => {
        const existing = await tx.table("bases").toArray();
        if (existing.length > 0) {
            await tx.table("views").bulkAdd(existing);
        }
    });

// Version 20 (Trash / soft-delete)
db.version(20).stores({
    ...preservedLegacyStores,
    notes: "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy, favorite, deletedAt",
    projects: "&id, title, folderPath, description, createdAt, updatedAt",
    tabs: "&id, noteId, order, createdAt",
    hashtags: "&id, hashtag, filename, project",
    settings: "&id, &name, value",
    scripts: "&id, name, createdAt, updatedAt",
    noteGroups: "&id, title, createdAt, updatedAt",
    noteGroupMembers: "&id, groupId, noteId, order, createdAt",
    aiConfigs: "&id, adapterId, isDefault, createdAt",
    aiChats: "&id, noteId, createdAt",
    aiMessages: "&id, chatId, role, createdAt",
    aiCredentials: "&adapterId",
    views: "&id, title, viewType, createdAt, updatedAt",
    bases: "&id, title, viewType, createdAt, updatedAt",
});

// Version 21 (Cursor positions)
db.version(21).stores({
    ...preservedLegacyStores,
    notes: "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy, favorite, deletedAt",
    projects: "&id, title, folderPath, description, createdAt, updatedAt",
    tabs: "&id, noteId, order, createdAt",
    hashtags: "&id, hashtag, filename, project",
    settings: "&id, &name, value",
    scripts: "&id, name, createdAt, updatedAt",
    noteGroups: "&id, title, createdAt, updatedAt",
    noteGroupMembers: "&id, groupId, noteId, order, createdAt",
    aiConfigs: "&id, adapterId, isDefault, createdAt",
    aiChats: "&id, noteId, createdAt",
    aiMessages: "&id, chatId, role, createdAt",
    aiCredentials: "&adapterId",
    views: "&id, title, viewType, createdAt, updatedAt",
    bases: "&id, title, viewType, createdAt, updatedAt",
    cursorPositions: "&noteId, y, anchor",
});

// Version 22 (Terminal session metadata)
db.version(22).stores({
    ...preservedLegacyStores,
    notes: "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy, favorite, deletedAt",
    projects: "&id, title, folderPath, description, createdAt, updatedAt",
    tabs: "&id, noteId, order, createdAt",
    hashtags: "&id, hashtag, filename, project",
    settings: "&id, &name, value",
    scripts: "&id, name, createdAt, updatedAt",
    noteGroups: "&id, title, createdAt, updatedAt",
    noteGroupMembers: "&id, groupId, noteId, order, createdAt",
    aiConfigs: "&id, adapterId, isDefault, createdAt",
    aiChats: "&id, noteId, createdAt",
    aiMessages: "&id, chatId, role, createdAt",
    aiCredentials: "&adapterId",
    views: "&id, title, viewType, createdAt, updatedAt",
    cursorPositions: "&noteId, y, anchor",
    terminalSessions: "&id, title, project, createdAt, updatedAt",
    bases: "&id, title, viewType, createdAt, updatedAt",
});

// Version 23 (Local note history)
db.version(23).stores({
    ...preservedLegacyStores,
    notes: "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy, favorite, deletedAt",
    noteHistory: "&id, noteId, createdAt",
    projects: "&id, title, folderPath, description, createdAt, updatedAt",
    tabs: "&id, noteId, order, createdAt",
    hashtags: "&id, hashtag, filename, project",
    settings: "&id, &name, value",
    scripts: "&id, name, createdAt, updatedAt",
    noteGroups: "&id, title, createdAt, updatedAt",
    noteGroupMembers: "&id, groupId, noteId, order, createdAt, updatedAt",
    aiConfigs: "&id, adapterId, isDefault, createdAt",
    aiChats: "&id, noteId, createdAt",
    aiMessages: "&id, chatId, role, createdAt",
    aiCredentials: "&adapterId",
    views: "&id, title, viewType, createdAt, updatedAt",
    cursorPositions: "&noteId, y, anchor",
    terminalSessions: "&id, title, project, createdAt, updatedAt",
    bases: "&id, title, viewType, createdAt, updatedAt",
});

// Version 24 (Preserve existing data and add a note-history query index)
db.version(24).stores({
    ...preservedLegacyStores,
    notes: "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy, favorite, deletedAt",
    noteHistory: "&id, noteId, createdAt, [noteId+createdAt]",
    projects: "&id, title, folderPath, description, createdAt, updatedAt",
    tabs: "&id, noteId, order, createdAt",
    hashtags: "&id, hashtag, filename, project",
    settings: "&id, &name, value",
    scripts: "&id, name, createdAt, updatedAt",
    noteGroups: "&id, title, createdAt, updatedAt",
    noteGroupMembers: "&id, groupId, noteId, order, createdAt, updatedAt",
    aiConfigs: "&id, adapterId, isDefault, createdAt",
    aiChats: "&id, noteId, createdAt",
    aiMessages: "&id, chatId, role, createdAt",
    aiCredentials: "&adapterId",
    views: "&id, title, viewType, createdAt, updatedAt",
    cursorPositions: "&noteId, y, anchor",
    terminalSessions: "&id, title, project, createdAt, updatedAt",
    bases: "&id, title, viewType, createdAt, updatedAt",
}).upgrade(migrateLegacyTemplates);

// Re-run the copy-only migrations for databases already opened at v24.
db.version(25).stores({
    ...preservedLegacyStores,
    notes: "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy, favorite, deletedAt",
    noteHistory: "&id, noteId, createdAt, [noteId+createdAt]",
    projects: "&id, title, folderPath, description, createdAt, updatedAt",
    tabs: "&id, noteId, order, createdAt",
    hashtags: "&id, hashtag, filename, project",
    settings: "&id, &name, value",
    scripts: "&id, name, createdAt, updatedAt",
    noteGroups: "&id, title, createdAt, updatedAt",
    noteGroupMembers: "&id, groupId, noteId, order, createdAt, updatedAt",
    aiConfigs: "&id, adapterId, isDefault, createdAt",
    aiChats: "&id, noteId, createdAt",
    aiMessages: "&id, chatId, role, createdAt",
    aiCredentials: "&adapterId",
    views: "&id, title, viewType, createdAt, updatedAt",
    cursorPositions: "&noteId, y, anchor",
    terminalSessions: "&id, title, project, createdAt, updatedAt",
    bases: "&id, title, viewType, createdAt, updatedAt",
}).upgrade(async (tx) => {
    await migrateLegacyProjects(tx);
    await migrateLegacyTemplates(tx);
});
