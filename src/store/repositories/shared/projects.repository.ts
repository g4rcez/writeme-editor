import { type StorageAdapter } from "../adapters/types";
import { BaseRepository } from "../base.repository";
import { type IProjectRepository, type Project } from "../entities/project";

export class ProjectsRepository extends BaseRepository<Project> implements IProjectRepository {
    constructor(adapter: StorageAdapter) {
        super(adapter, "projects");
    }
}
