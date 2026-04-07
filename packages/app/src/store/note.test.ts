import { describe, it, expect } from "vitest";
import { Note } from "./note";

describe("Note", () => {
  it("should create a new note with default values", () => {
    const note = Note.new("Test Title", "Test Content");
    expect(note.title).toBe("Test Title");
    expect(note.content).toBe("Test Content");
    expect(note.noteType).toBe("note");
    expect(note.url).toBeNull();
    expect(note.description).toBeNull();
    expect(note.favicon).toBeNull();
  });

  it("should create a new read-it-later note", () => {
    const note = Note.new("Article", "Content", "read-it-later", "https://example.com", "A description", "https://example.com/favicon.ico");
    expect(note.title).toBe("Article");
    expect(note.content).toBe("Content");
    expect(note.noteType).toBe("read-it-later");
    expect(note.url).toBe("https://example.com");
    expect(note.description).toBe("A description");
    expect(note.favicon).toBe("https://example.com/favicon.ico");
  });

  it("should create a new template note", () => {
    const note = Note.new("My Template", "Template Content", "template");
    expect(note.title).toBe("My Template");
    expect(note.content).toBe("Template Content");
    expect(note.noteType).toBe("template");
  });

  it("should create a new json note", () => {
    const note = Note.new("My JSON", '{"a":1}', "json" as any);
    expect(note.title).toBe("My JSON");
    expect(note.content).toBe('{"a":1}');
    expect(note.noteType).toBe("json");
  });

  it("should parse a note object", () => {
    const data = {
      title: "Parsed Title",
      content: "Parsed Content",
      noteType: "read-it-later",
      url: "https://parsed.com",
      description: "Parsed Desc",
      favicon: "https://parsed.com/icon.png",
    };
    const note = Note.parse(data);
    expect(note.title).toBe("Parsed Title");
    expect(note.content).toBe("Parsed Content");
    expect(note.noteType).toBe("read-it-later");
    expect(note.url).toBe("https://parsed.com");
    expect(note.description).toBe("Parsed Desc");
    expect(note.favicon).toBe("https://parsed.com/icon.png");
  });

  it("should handle missing url in parse", () => {
    const data = {
      title: "No URL",
      content: "Content",
    };
    const note = Note.parse(data);
    expect(note.url).toBeNull();
  });
});
