import type { EntityBase, Repository } from "../../repository";

export class Tab implements EntityBase {
  public constructor(
    public id: string,
    public noteId: string,
    public order: number,
    public project: string,
    public createdAt: Date,
    public type: string,
    public updatedAt: Date,
    public scrollY: number = 0,
  ) {}
}

export interface ITabRepository extends Repository<Tab> {
  clear: () => Promise<void>;
  updateOrder: (tabs: Tab[]) => Promise<void>;
  deleteByNoteId: (noteId: string) => Promise<void>;
}
