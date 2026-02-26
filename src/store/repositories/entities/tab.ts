import { type EntityBase, type Repository } from "../../repository";

export class Tab implements EntityBase {
  public constructor(
    public id: string,
    public noteId: string,
    public order: number,
    public project: string,
    public createdAt: Date,
    public type: string,
    public updatedAt: Date,
  ) {}
}

export interface ITabRepository extends Repository<Tab> {
  clear: () => Promise<void>;
  updateOrder: (tabs: Tab[]) => Promise<void>;
  deleteByNoteId: (noteId: string) => Promise<void>;
}
