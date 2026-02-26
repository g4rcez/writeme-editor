import { type EntityBase, type Repository } from "@/store/repository";

export class Script implements EntityBase {
  public readonly type = "script";
  public constructor(
    public readonly id: string,
    public name: string,
    public content: string,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  public static parse(data: any): Script {
    return new Script(
      data.id,
      data.name,
      data.content,
      new Date(data.createdAt),
      new Date(data.updatedAt),
    );
  }
}

export interface IScriptRepository extends Repository<Script> {}
