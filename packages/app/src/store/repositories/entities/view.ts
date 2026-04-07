import { type EntityBase, type Repository } from "../../repository";

export type ViewColumn = {
  field: string;
  label: string;
  width?: number;
};

export type ViewDisplayType = "table" | "kanban" | "calendar";

export class View implements EntityBase {
  public readonly type = "view" as const;

  public constructor(
    public readonly id: string,
    public title: string,
    public query: string,
    public columns: ViewColumn[],
    public viewType: ViewDisplayType,
    public sortField: string | null,
    public sortDirection: "ASC" | "DESC",
    public viewConfig: Record<string, unknown>,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}
}

export interface IViewRepository extends Repository<View> {}
