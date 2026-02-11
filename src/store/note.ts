import { uuid } from "@g4rcez/components";
import { EntityBase } from "./repository";

type NoteType = "note" | "quick" | "read-it-later";

export class Note implements EntityBase {
  public readonly type = "__writeme_note";

  private constructor(
    public title: string,
    public content: string,
    public readonly id: string,
    public readonly project: string,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public filePath: string | null,
    public fileSize: number,
    public lastSynced: Date | null,
    public tags: string[],
    public createdBy: string,
    public updatedBy: string,
    public noteType: NoteType,
    public url: string | null,
  ) { }

  public static new(
    title: string,
    content: string,
    noteType: NoteType = "note",
    url: string | null = null,
  ) {
    const now = new Date();
    return new Note(
      title,
      content,
      uuid(),
      "",
      now,
      now,
      null,
      0,
      null,
      [],
      "user",
      "user",
      noteType,
      url,
    );
  }

  public setContent(content: string) {
    this.content = content;
    this.updatedAt = new Date();
    this.fileSize = content.length;
  }

  public setTitle(title: string) {
    this.title = title;
    this.updatedAt = new Date();
  }

  public setFilePath(path: string, synced: Date) {
    this.filePath = path;
    this.lastSynced = synced;
  }

  public addTag(tag: string) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updatedAt = new Date();
    }
  }

  public removeTag(tag: string) {
    const originalLength = this.tags.length;
    this.tags = this.tags.filter((t) => t !== tag);
    if (this.tags.length !== originalLength) {
      this.updatedAt = new Date();
    }
  }

  public static parse(a: any): Note {
    return new Note(
      a.title || "Untitled",
      a.content || "",
      a.id || uuid(),
      "",
      a.createdAt ? new Date(a.createdAt) : new Date(),
      a.updatedAt ? new Date(a.updatedAt) : new Date(),
      a.filePath || null,
      a.fileSize || 0,
      a.lastSynced ? new Date(a.lastSynced) : null,
      a.tags || [],
      a.createdBy || "user",
      a.updatedBy || "user",
      a.noteType || "note",
      a.url || null,
    );
  }
}
