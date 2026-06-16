import { describe, expect, it } from "vitest";

import { AI_CHAT_TAB_TYPE } from "./tab-target";
import { getCycledTabNoteId, getCycledTabTarget } from "./tab-cycling";

const tabs = [
  { id: "tab-2", noteId: "note-2", order: 2, type: "tab" },
  { id: "tab-1", noteId: "note-1", order: 1, type: "tab" },
  { id: "tab-3", noteId: "note-3", order: 3, type: "tab" },
];

const mixedTabs = [
  { id: "note-tab-1", noteId: "note-1", order: 0, type: "tab" },
  {
    id: "chat-tab-1",
    noteId: "chat-1",
    order: 1,
    type: AI_CHAT_TAB_TYPE,
  },
  { id: "note-tab-2", noteId: "note-2", order: 2, type: "tab" },
];

describe("getCycledTabTarget", () => {
  it("cycles forward across note and AI chat tabs", () => {
    expect(
      getCycledTabTarget({
        tabs: mixedTabs,
        currentTarget: { type: "note", id: "note-1" },
        activeTabId: null,
        direction: "forward",
      }),
    ).toStrictEqual({ type: "ai-chat", id: "chat-1" });

    expect(
      getCycledTabTarget({
        tabs: mixedTabs,
        currentTarget: { type: "ai-chat", id: "chat-1" },
        activeTabId: null,
        direction: "forward",
      }),
    ).toStrictEqual({ type: "note", id: "note-2" });
  });

  it("cycles backward across note and AI chat tabs", () => {
    expect(
      getCycledTabTarget({
        tabs: mixedTabs,
        currentTarget: { type: "note", id: "note-2" },
        activeTabId: null,
        direction: "backward",
      }),
    ).toStrictEqual({ type: "ai-chat", id: "chat-1" });
  });

  it("falls back to the active tab id when the current route target is unavailable", () => {
    expect(
      getCycledTabTarget({
        tabs: mixedTabs,
        currentTarget: null,
        activeTabId: "chat-tab-1",
        direction: "forward",
      }),
    ).toStrictEqual({ type: "note", id: "note-2" });
  });
});

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
        tabs: [{ id: "tab-1", noteId: "note-1", order: 1, type: "tab" }],
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
