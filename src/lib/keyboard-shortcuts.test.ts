import { describe, expect, it } from "vitest";

import { isCommanderShortcut } from "./keyboard-shortcuts";

const event = (
  overrides: Partial<Parameters<typeof isCommanderShortcut>[0]>,
): Parameters<typeof isCommanderShortcut>[0] => ({
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  key: "",
  ...overrides,
});

describe("keyboard shortcuts", () => {
  it("matches Ctrl+Shift+P", () => {
    expect(
      isCommanderShortcut(event({ ctrlKey: true, shiftKey: true, key: "P" })),
    ).toBe(true);
  });

  it("matches Cmd+Shift+P", () => {
    expect(
      isCommanderShortcut(event({ metaKey: true, shiftKey: true, key: "P" })),
    ).toBe(true);
  });

  it("does not match without Shift", () => {
    expect(isCommanderShortcut(event({ ctrlKey: true, key: "p" }))).toBe(false);
  });

  it("does not match a different key", () => {
    expect(
      isCommanderShortcut(event({ ctrlKey: true, shiftKey: true, key: "k" })),
    ).toBe(false);
  });
});
