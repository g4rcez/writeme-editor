import { BaseRepository } from "../base.repository";
import { DexieStorageAdapter } from "../adapters/dexie.adapter";
import {
  type INoteGroupMemberRepository,
  NoteGroupMember,
} from "../entities/note-group-member";
import { db } from "./dexie-db";

export class NoteGroupMembersRepository
  extends BaseRepository<NoteGroupMember>
  implements INoteGroupMemberRepository
{
  constructor() {
    super(
      new DexieStorageAdapter(),
      "noteGroupMembers",
      (a, b) => a.order - b.order,
    );
  }

  async getByGroupId(groupId: string): Promise<NoteGroupMember[]> {
    const items = await db.noteGroupMembers
      .where("groupId")
      .equals(groupId)
      .toArray();
    return items.sort((a, b) => a.order - b.order);
  }

  async reorder(
    _groupId: string,
    members: NoteGroupMember[],
  ): Promise<void> {
    await db.transaction("rw", db.noteGroupMembers, async () => {
      for (const member of members) {
        await db.noteGroupMembers.update(member.id, { order: member.order });
      }
    });
  }

  async deleteByNoteId(noteId: string): Promise<void> {
    await db.noteGroupMembers.where("noteId").equals(noteId).delete();
  }

  async deleteByGroupId(groupId: string): Promise<void> {
    await db.noteGroupMembers.where("groupId").equals(groupId).delete();
  }
}
