import Dexie, { EntityTable } from "dexie";
import { Note } from "../../note";
import { Project } from "../../project";

export interface Tab {
  id: string;
  noteId: string;
  order: number;
  project: string;
  createdAt: Date;
}

export const db = new Dexie("writeme") as Dexie & {
  notes: EntityTable<Note, "id">;
  projects: EntityTable<Project, "id">;
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
    // Remove 'content' from indexed fields, add new metadata fields
    // *tags creates a multiEntry index for searching by tags
    notes:
      "&id, title, project, filePath, *tags, createdAt, updatedAt, createdBy, updatedBy",
    projects: "&id, title, description, *notes, createdAt, updatedAt",
  })
  .upgrade(async (tx) => {
    // Migrate existing notes from v1 to v2
    const notes = await tx.table("notes").toArray();

    console.log(`Migrating ${notes.length} notes to schema v2...`);

    for (const note of notes) {
      await tx.table("notes").update(note.id, {
        filePath: null, // Mark for migration - will be set when note is saved
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
    // Migrate existing projects to have folderPath
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
// No structural change to indexes - content field already exists on Note objects
// This version enables storing full note content in IndexedDB when running
// without filesystem access (web mode or Electron without storageDirectory)
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
