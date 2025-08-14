import { Project } from "../../project";
import { EntityBase, Repository } from "../../repository";

export class ProjectsRepository implements Repository<Project> {
  async update(id: EntityBase["id"], item: Project): Promise<Project> {
    throw new Error("Method not implemented.");
  }

  async save(item: Project): Promise<Project> {
    throw new Error("Method not implemented.");
  }

  async getOne(id: EntityBase["id"]): Promise<Project[]> {
    throw new Error("Method not implemented.");
  }

  async getAll(): Promise<Project[]> {
    throw new Error("Method not implemented.");
  }
}
