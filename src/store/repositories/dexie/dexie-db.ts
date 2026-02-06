import Dexie, { EntityTable } from "dexie";
import { Note } from "../../note";

export interface Tab {
  id: string;
  noteId: string;
  order: number;
  project: string;
  createdAt: Date;
}

export const db = new Dexie("writeme") as Dexie & {
  notes: EntityTable<Note, "id">;
  projects: EntityTable<any, "id">;
  tabs: EntityTable<Tab, "id">;
};

// Version 1 (original schema)
db.version(1).stores({
  notes: "&id, title, content, project, createdAt, updatedAt",
  project: "&id, title, description, *notes, createdAt, updatedAt",
});

// Version 2 (hybrid storage - add metadata fields, content no longer indexed)
db.version(2)
  .stores({
    notes:
      "&id, title, project, filePath, *tags, createdAt, updatedAt, createdBy, updatedBy",
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
    console.log("Schema migration to v2 complete");
  });

// Version 3 (add folderPath to projects for Open Project feature)
db.version(3)
  .stores({
    notes:
      "&id, title, project, filePath, *tags, createdAt, updatedAt, createdBy, updatedBy",
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
    notes:
      "&id, title, project, filePath, *tags, createdAt, updatedAt, createdBy, updatedBy",
    projects: "&id, title, folderPath, description, createdAt, updatedAt",
  })
  .upgrade(async () => {
    console.log("Schema migration to v4 complete (IndexedDB content support)");
  });

// Version 5 (Tabs support)
db.version(5).stores({
  notes:
    "&id, title, project, filePath, *tags, createdAt, updatedAt, createdBy, updatedBy",
  projects: "&id, title, folderPath, description, createdAt, updatedAt",
  tabs: "&id, noteId, order, project, createdAt",
});

// Version 6 (Remove project concept — folder IS the project)
// Drop project from notes/tabs indexes; keep projects table in schema (can't remove)
db.version(6)
  .stores({
    notes:
      "&id, title, filePath, *tags, createdAt, updatedAt, createdBy, updatedBy",
    projects: "&id, title, folderPath, description, createdAt, updatedAt",
    tabs: "&id, noteId, order, createdAt",
  })
  .upgrade(async (tx) => {
    console.log("Migrating to v6: removing project references...");
    const notes = await tx.table("notes").toArray();
    for (const note of notes) {
      await tx.table("notes").update(note.id, { project: "" });
    }
    const tabs = await tx.table("tabs").toArray();
    for (const tab of tabs) {
      await tx.table("tabs").update(tab.id, { project: "" });
    }
    console.log("Schema migration to v6 complete");
  });

// Version 7 (Add noteType field for quicknotes support)
db.version(7)
  .stores({
    notes:
      "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy",
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
