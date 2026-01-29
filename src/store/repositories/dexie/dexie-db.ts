import Dexie, { EntityTable } from "dexie";
import { Note } from "../../note";
import { Project } from "../../project";

export const db = new Dexie("writeme") as Dexie & {
  notes: EntityTable<Note, "id">;
  projects: EntityTable<Project, "id">;
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
