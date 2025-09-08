import { uuid } from "@g4rcez/components";
import { EntityBase } from "./repository";

export class Note implements EntityBase {
  private static PROJECT = "00000000-0000-0000-0000-000000000000";
  public readonly type = "__writeme_note";

  private constructor(
    public title: string,
    public content: string,
    public readonly id: string,
    public readonly project: string,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) { }

  public static new(title: string, content: string, project?: string) {
    const now = new Date();
    return new Note(title, content, uuid(), project || Note.PROJECT, now, now);
  }

  public setContent(content: string) {
    this.content = content;
    this.updatedAt = new Date();
  }

  public setTitle(title: string) {
    this.title = title;
    this.updatedAt = new Date();
  }

  public static parse(a: any): Note {
    return new Note(
      a.title,
      a.content,
      a.id,
      a.project,
      a.createdAt,
      a.updatedAt,
    );
  }
}
