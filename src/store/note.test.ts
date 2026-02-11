import { describe, it, expect } from "vitest";
import { Note } from "./note";

describe("Note", () => {
  it("should create a new note with default values", () => {
    const note = Note.new("Test Title", "Test Content");
    expect(note.title).toBe("Test Title");
    expect(note.content).toBe("Test Content");
    expect(note.noteType).toBe("note");
    expect(note.url).toBeNull();
  });

  it("should create a new read-it-later note", () => {
    const note = Note.new("Article", "Content", "read-it-later", "https://example.com");
    expect(note.title).toBe("Article");
    expect(note.content).toBe("Content");
    expect(note.noteType).toBe("read-it-later");
    expect(note.url).toBe("https://example.com");
  });

  it("should parse a note object", () => {
    const data = {
      title: "Parsed Title",
      content: "Parsed Content",
      noteType: "read-it-later",
      url: "https://parsed.com",
    };
    const note = Note.parse(data);
    expect(note.title).toBe("Parsed Title");
    expect(note.content).toBe("Parsed Content");
    expect(note.noteType).toBe("read-it-later");
    expect(note.url).toBe("https://parsed.com");
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
