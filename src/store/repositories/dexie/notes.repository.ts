import { Note } from "../../note";
import { EntityBase, Repository } from "../../repository";
import { db } from "./dexie-db";

export class NotesRepository implements Repository<Note> {
  async count(): Promise<number> {
    const c = await db.notes.count();
    return c;
  }
  async update(id: EntityBase["id"], item: Note): Promise<Note> {
    await db.notes.put(item, id);
    return item;
  }

  async save(item: Note): Promise<Note> {
    await db.notes.add(item, item.id);
    return item;
  }

  async getOne(id: EntityBase["id"]): Promise<Note[]> {
    throw new Error("Method not implemented.");
  }

  async getAll(): Promise<Note[]> {
    const notes = await db.notes.toArray();
    return notes
      .map(Note.parse)
      .toSorted((a, b) => +a.createdAt - +b.createdAt);
  }
}
