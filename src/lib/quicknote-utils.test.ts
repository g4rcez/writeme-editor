import { describe, expect, it } from "vitest";
import {
  getDailyQuickNoteName,
  getDailyQuickNotePath,
  getDailyQuickNoteTitle,
} from "./quicknote-utils";

describe("quicknote utils", () => {
  it("builds the daily quicknote file name and path", () => {
    const date = new Date("2026-06-08T15:30:00.000Z");

    expect(getDailyQuickNoteName(date)).toBe("2026-06-08-quicknote");
    expect(getDailyQuickNoteTitle(date)).toBe("2026-06-08-quicknote.md");
    expect(getDailyQuickNotePath("/Users/allan/notes", date)).toBe(
      "/Users/allan/notes/quicknotes/2026-06-08-quicknote.md",
    );
  });
});
