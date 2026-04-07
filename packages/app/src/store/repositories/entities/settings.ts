import { type EntityBase, type Repository } from "@/store/repository";

export class Settings implements EntityBase {
  public constructor(
    public id: string,
    public name: string,
    public value: string,
    public type: string,
    public createdAt: Date,
    public updatedAt: Date,
  ) {}
}

export interface ISettingsRepository extends Repository<Settings> {}
