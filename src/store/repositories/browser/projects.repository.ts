import { type IProjectRepository, type Project } from "../entities/project";
import { BaseRepository } from "../base.repository";
import { DexieStorageAdapter } from "../adapters/dexie.adapter";

export class ProjectsRepository
  extends BaseRepository<Project>
  implements IProjectRepository
{
  constructor() {
    super(new DexieStorageAdapter(), "projects");
  }
}
