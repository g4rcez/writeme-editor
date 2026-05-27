import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/store/repositories", () => ({
  repositories: {
    notes: {
      purgeBefore: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock("@/store/settings", () => ({
  SettingsService: {
    get: vi.fn(),
  },
}));

import { runPurge } from "./purge";
import { repositories } from "@/store/repositories";
import { SettingsService } from "@/store/settings";

const mockPurgeBefore = repositories.notes.purgeBefore as ReturnType<
  typeof vi.fn
>;
const mockGet = SettingsService.get as ReturnType<typeof vi.fn>;

describe("runPurge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when retention is 'never'", async () => {
    mockGet.mockReturnValue({ trashRetentionDays: "never" });
    await runPurge();
    expect(mockPurgeBefore).not.toHaveBeenCalled();
  });

  it("calls purgeBefore with correct cutoff for 7-day retention", async () => {
    const now = new Date("2024-06-10T12:00:00.000Z");
    vi.setSystemTime(now);
    mockGet.mockReturnValue({ trashRetentionDays: 7 });

    await runPurge();

    expect(mockPurgeBefore).toHaveBeenCalledOnce();
    const call = mockPurgeBefore.mock.calls[0];
    if (!call) throw new Error("Expected purgeBefore to be called");
    const cutoff: Date = call[0];
    const expected = new Date("2024-06-03T12:00:00.000Z");
    expect(cutoff.toISOString()).toBe(expected.toISOString());

    vi.useRealTimers();
  });

  it("calls purgeBefore with correct cutoff for 30-day retention", async () => {
    const now = new Date("2024-07-01T00:00:00.000Z");
    vi.setSystemTime(now);
    mockGet.mockReturnValue({ trashRetentionDays: 30 });

    await runPurge();

    expect(mockPurgeBefore).toHaveBeenCalledOnce();
    const call = mockPurgeBefore.mock.calls[0];
    if (!call) throw new Error("Expected purgeBefore to be called");
    const cutoff: Date = call[0];
    const expected = new Date("2024-06-01T00:00:00.000Z");
    expect(cutoff.toISOString()).toBe(expected.toISOString());

    vi.useRealTimers();
  });
});
