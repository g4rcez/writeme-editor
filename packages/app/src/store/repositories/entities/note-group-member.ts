import { type EntityBase, type Repository } from "../../repository";

export class NoteGroupMember implements EntityBase {
  public readonly type = "noteGroupMember";

  public constructor(
    public readonly id: string,
    public readonly groupId: string,
    public readonly noteId: string,
    public order: number,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}
}

export interface INoteGroupMemberRepository extends Repository<NoteGroupMember> {
  getByGroupId(groupId: string): Promise<NoteGroupMember[]>;
  reorder(groupId: string, members: NoteGroupMember[]): Promise<void>;
  deleteByNoteId(noteId: string): Promise<void>;
  deleteByGroupId(groupId: string): Promise<void>;
}
