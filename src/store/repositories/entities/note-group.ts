import { type EntityBase, type Repository } from "../../repository";

export class NoteGroup implements EntityBase {
  public readonly type = "noteGroup";

  public constructor(
    public readonly id: string,
    public title: string,
    public description: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}
}

export interface INoteGroupRepository extends Repository<NoteGroup> {
  getByNoteId(noteId: string): Promise<NoteGroup[]>;
}
