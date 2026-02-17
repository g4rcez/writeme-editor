import { EntityBase, Repository } from "@/store/repository";

export class Project implements EntityBase {
  public constructor(
    public id: string,
    public name: string,
    public createdAt: Date,
    public updatedAt: Date,
    public type: string,
  ) { }
}

export interface IProjectRepository extends Repository<Project> { }
