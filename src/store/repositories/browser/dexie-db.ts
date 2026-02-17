import Dexie, { EntityTable } from "dexie";
import { Note } from "../../note";
import { Tab } from "../entities/tab";
import { Hashtag } from "../entities/hashtag";
import { Settings } from "../entities/settings";
import { Project } from "../entities/project";

export const db = new Dexie("writeme") as Dexie & {
  notes: EntityTable<Note, "id">;
  projects: EntityTable<Project, "id">;
  tabs: EntityTable<Tab, "id">;
  hashtags: EntityTable<Hashtag, "id">;
  settings: EntityTable<Settings, "id">;
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

// Version 8 (Hashtags support)
db.version(8).stores({
  notes:
    "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy",
  projects: "&id, title, folderPath, description, createdAt, updatedAt",
  tabs: "&id, noteId, order, createdAt",
  hashtags: "&id, hashtag, filename, project",
});

// Version 9 (Settings support)
db.version(9)
  .stores({
    notes:
      "&id, title, filePath, noteType, *tags, createdAt, updatedAt, createdBy, updatedBy",
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
      const exists = await tx
        .table("settings")
        .where("name")
        .equals(def.name)
        .first();
      if (!exists) {
        await tx.table("settings").add({
          id: crypto.randomUUID(),
          name: def.name,
          value: def.value,
        });
      }
    }
  });
