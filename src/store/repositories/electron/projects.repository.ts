import { IProjectRepository, Project } from "../entities/project";
import { BaseRepository } from "../base.repository";
import { ElectronStorageAdapter } from "../adapters/electron.adapter";

export class ProjectsRepository extends BaseRepository<Project> implements IProjectRepository {
  constructor() {
    super(new ElectronStorageAdapter(), "projects");
  }
}
