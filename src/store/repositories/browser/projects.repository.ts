import { EntityBase } from "@/store/repository";
import { IProjectRepository, Project } from "../entities/project";
import { db } from "./dexie-db";

export class ProjectsRepository implements IProjectRepository {
  async count(): Promise<number> {
    return await db.projects.count();
  }

  async getOne(id: EntityBase["id"]): Promise<Project | null> {
    return (await db.projects.get(id)) || null;
  }

  async update(id: EntityBase["id"], item: Project): Promise<Project> {
    await db.projects.put(item, id);
    return item;
  }

  async getAll(query?: { limit?: number }): Promise<Project[]> {
    let collection = db.projects.toCollection();
    if (query?.limit) {
      collection = collection.limit(query.limit);
    }
    return await collection.toArray();
  }

  async save(project: Project): Promise<Project> {
    await db.projects.put(project);
    return project;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await db.projects.get(id);
    if (!existing) return false;
    await db.projects.delete(id);
    return true;
  }
}