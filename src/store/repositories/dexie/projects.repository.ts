import { Project } from "../../project";
import { EntityBase, Repository } from "../../repository";
import { db } from "./dexie-db";

export class ProjectsRepository implements Repository<Project> {
  async save(item: Project): Promise<Project> {
    await db.projects.add(item as any, item.id);
    return item;
  }

  async update(id: EntityBase["id"], item: Project): Promise<Project> {
    await db.projects.put(item as any, id);
    return item;
  }

  async getOne(id: EntityBase["id"]): Promise<Project | null> {
    const project = await db.projects.get(id);
    return project ? Project.parse(project) : null;
  }

  async getAll(): Promise<Project[]> {
    const projects = await db.projects.orderBy("updatedAt").reverse().toArray();
    return projects.map(Project.parse);
  }

  async getByFolderPath(path: string): Promise<Project | null> {
    const project = await db.projects.where("folderPath").equals(path).first();
    return project ? Project.parse(project) : null;
  }

  async count(): Promise<number> {
    return db.projects.count();
  }

  async delete(id: EntityBase["id"]): Promise<boolean> {
    await db.projects.delete(id);
    return true;
  }
}
