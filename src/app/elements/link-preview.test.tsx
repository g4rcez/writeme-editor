import { describe, expect, it } from "vitest";

import { Note } from "@/store/note";

import {
  createNoteLinkPreview,
  createPlainTextExcerpt,
  findMentionNote,
} from "./link-preview";

describe("link-preview helpers", () => {
  it("finds mention notes by id, title, or file path", () => {
    const note = Note.parse({
      id: "note-123",
      title: "Project Plan",
      content: "Draft content",
    });
    note.setFilePath("notes/project-plan.md", new Date("2026-01-01"));

    expect(findMentionNote([note], note.id)).toBe(note);
    expect(findMentionNote([note], "project plan")).toBe(note);
    expect(findMentionNote([note], "notes/project-plan.md")).toBe(note);
    expect(
      findMentionNote([note], {
        id: "missing-id",
        label: "Missing label",
        path: "/note/note-123",
      }),
    ).toBe(note);
    expect(
      findMentionNote([note], {
        id: "missing-id",
        label: "Missing label",
        path: "http://localhost:5173/@mention/note/note-123",
      }),
    ).toBe(note);
  });

  it("resolves mention previews from label and path fallbacks", () => {
    const note = Note.parse({
      id: "note-456",
      title: "Daily Log",
      content: "Today I shipped link previews.",
    });

    expect(
      createNoteLinkPreview(
        [note],
        { id: "missing-id", label: "daily log", path: "" },
        "daily log",
      ),
    ).toMatchObject({ title: "Daily Log", exists: true });
    expect(
      createNoteLinkPreview(
        [note],
        {
          id: "missing-id",
          label: "Missing label",
          path: "@mention/note/note-456",
        },
        "Missing label",
      ),
    ).toMatchObject({ title: "Daily Log", exists: true });
  });

  it("creates a plaintext excerpt from markdown content", () => {
    expect(
      createPlainTextExcerpt(
        "# Heading\nRead [the docs](https://example.com) and `ship it` today.",
        34,
      ),
    ).toBe("Heading Read the docs and ship it…");
  });

  it("returns a missing note preview when lookup fails", () => {
    expect(
      createNoteLinkPreview(
        [],
        { id: "missing-id", label: "Missing label", path: "" },
        "Missing label",
      ),
    ).toEqual({
      title: "Missing label",
      excerpt: "Note not found.",
      exists: false,
    });
  });
});
