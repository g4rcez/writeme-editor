import { BaseRepository } from "../base.repository";
import { ElectronStorageAdapter } from "../adapters/electron.adapter";
import {
  type INoteGroupMemberRepository,
  type NoteGroupMember,
} from "../entities/note-group-member";

export class NoteGroupMembersRepository
  extends BaseRepository<NoteGroupMember>
  implements INoteGroupMemberRepository
{
  constructor() {
    super(
      new ElectronStorageAdapter(),
      "noteGroupMembers",
      (a, b) => a.order - b.order,
    );
  }

  async getByGroupId(groupId: string): Promise<NoteGroupMember[]> {
    return window.electronAPI.db.noteGroupMembers.getByGroupId(groupId);
  }

  async reorder(
    _groupId: string,
    members: NoteGroupMember[],
  ): Promise<void> {
    return window.electronAPI.db.noteGroupMembers.reorder(
      members.map((m) => ({ id: m.id, order: m.order })),
    );
  }

  async deleteByNoteId(noteId: string): Promise<void> {
    return window.electronAPI.db.noteGroupMembers.deleteByNoteId(noteId);
  }

  async deleteByGroupId(groupId: string): Promise<void> {
    return window.electronAPI.db.noteGroupMembers.deleteByGroupId(groupId);
  }
}
