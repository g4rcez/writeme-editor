import { Note } from "./note";
import { EntityBase } from "./repository";

export class Project implements EntityBase {
  public readonly type = "__writeme_project";

  private constructor(
    public title: string,
    public readonly id: string,
    public readonly description: string,
    public notes: Note[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) { }

  public static new(title: string, content: string, description: string) {
    const now = new Date();
    return new Project(title, content, description, [], now, now);
  }
}
