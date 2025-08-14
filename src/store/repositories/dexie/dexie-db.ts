import Dexie, { EntityTable } from "dexie";
import { Note } from "../../note";
import { Project } from "../../project";

export const db = new Dexie("writeme") as Dexie & {
  notes: EntityTable<Note, "id">;
  projects: EntityTable<Project, "id">;
};

db.version(1).stores({
  notes: "&id, title, content, project, createdAt, updatedAt",
  project: "&id, title, description, *notes, createdAt, updatedAt",
});
