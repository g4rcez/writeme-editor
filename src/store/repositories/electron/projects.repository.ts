import { EntityBase } from "@/store/repository";
import { IProjectRepository, Project } from "../entities/project";

export class ProjectsRepository implements IProjectRepository {
  async count(): Promise<number> {
    return await window.electronAPI.db.count("projects");
  }

  async getOne(id: EntityBase["id"]): Promise<Project | null> {
    return (await window.electronAPI.db.get<Project>("projects", id)) || null;
  }

  async update(id: EntityBase["id"], item: Project): Promise<Project> {
    await window.electronAPI.db.save("projects", { ...item, id });
    return item;
  }

  async getAll(query?: { limit?: number }): Promise<Project[]> {
    const all = await window.electronAPI.db.getAll<Project>("projects");
    if (query?.limit) {
      return all.slice(0, query.limit);
    }
    return all;
  }

  async save(project: Project): Promise<Project> {
    await window.electronAPI.db.save("projects", project);
    return project;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.getOne(id);
    if (!existing) return false;
    await window.electronAPI.db.delete("projects", id);
    return true;
  }
}