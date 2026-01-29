import { Note } from "./note";
import { EntityBase } from "./repository";

export class Project implements EntityBase {
  public readonly type = "__writeme_project";

  private constructor(
    public title: string,
    public readonly id: string,
    public readonly description: string,
    public folderPath: string,
    public notes: Note[],
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) { }

  public static new(title: string, folderPath: string, description: string = "") {
    const now = new Date();
    return new Project(title, crypto.randomUUID(), description, folderPath, [], now, now);
  }

  public static fromPath(folderPath: string): Project {
    const title = folderPath.split(/[/\\]/).pop() || "Untitled";
    return Project.new(title, folderPath);
  }

  public static parse(a: any): Project {
    return new Project(
      a.title || "Untitled",
      a.id || crypto.randomUUID(),
      a.description || "",
      a.folderPath || "",
      a.notes || [],
      a.createdAt ? new Date(a.createdAt) : new Date(),
      a.updatedAt ? new Date(a.updatedAt) : new Date(),
    );
  }
}
