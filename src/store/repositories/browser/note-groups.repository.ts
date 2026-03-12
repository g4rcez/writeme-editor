import { BaseRepository } from "../base.repository";
import { DexieStorageAdapter } from "../adapters/dexie.adapter";
import { type INoteGroupRepository, NoteGroup } from "../entities/note-group";
import { db } from "./dexie-db";

export class NoteGroupsRepository
  extends BaseRepository<NoteGroup>
  implements INoteGroupRepository
{
  constructor() {
    super(new DexieStorageAdapter(), "noteGroups");
  }

  async getByNoteId(noteId: string): Promise<NoteGroup[]> {
    const members = await db.noteGroupMembers
      .where("noteId")
      .equals(noteId)
      .toArray();
    const groups = await Promise.all(
      members.map((m) => this.getOne(m.groupId)),
    );
    return groups.filter(Boolean) as NoteGroup[];
  }
}
