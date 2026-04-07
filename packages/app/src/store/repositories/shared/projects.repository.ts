import { type IProjectRepository, type Project } from "../entities/project";
import { BaseRepository } from "../base.repository";
import { type StorageAdapter } from "../adapters/types";

export class ProjectsRepository
  extends BaseRepository<Project>
  implements IProjectRepository
{
  constructor(adapter: StorageAdapter) {
    super(adapter, "projects");
  }
}
