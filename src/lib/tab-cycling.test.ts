import { describe, expect, it } from "vitest";

import { getCycledTabNoteId } from "./tab-cycling";

const tabs = [
  { id: "tab-2", noteId: "note-2", order: 2 },
  { id: "tab-1", noteId: "note-1", order: 1 },
  { id: "tab-3", noteId: "note-3", order: 3 },
];

describe("getCycledTabNoteId", () => {
  it("cycles forward in tab order and wraps to the first tab", () => {
    expect(
      getCycledTabNoteId({
        tabs,
        currentNoteId: "note-1",
        activeTabId: null,
        direction: "forward",
      }),
    ).toBe("note-2");

    expect(
      getCycledTabNoteId({
        tabs,
        currentNoteId: "note-3",
        activeTabId: null,
        direction: "forward",
      }),
    ).toBe("note-1");
  });

  it("cycles backward in tab order and wraps to the last tab", () => {
    expect(
      getCycledTabNoteId({
        tabs,
        currentNoteId: "note-2",
        activeTabId: null,
        direction: "backward",
      }),
    ).toBe("note-1");

    expect(
      getCycledTabNoteId({
        tabs,
        currentNoteId: "note-1",
        activeTabId: null,
        direction: "backward",
      }),
    ).toBe("note-3");
  });

  it("falls back to the active tab id when the current route note is unavailable", () => {
    expect(
      getCycledTabNoteId({
        tabs,
        currentNoteId: null,
        activeTabId: "tab-2",
        direction: "forward",
      }),
    ).toBe("note-3");
  });

  it("returns null when tab cycling is not possible", () => {
    expect(
      getCycledTabNoteId({
        tabs: [{ id: "tab-1", noteId: "note-1", order: 1 }],
        currentNoteId: "note-1",
        activeTabId: "tab-1",
        direction: "forward",
      }),
    ).toBeNull();

    expect(
      getCycledTabNoteId({
        tabs,
        currentNoteId: "missing",
        activeTabId: "also-missing",
        direction: "forward",
      }),
    ).toBeNull();
  });
});
