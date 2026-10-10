import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsRepository } from "./repositories/shared/settings.repository";
import { SettingsService } from "./settings";

afterEach(() => vi.restoreAllMocks());

describe("meeting settings persistence", () => {
    it("keeps cached settings unchanged when storage rejects a save", async () => {
        const before = SettingsService.load();
        vi.spyOn(SettingsRepository.prototype, "getAll").mockResolvedValue([]);
        vi.spyOn(SettingsRepository.prototype, "save").mockRejectedValue(new Error("Storage unavailable"));
        await expect(SettingsService.save({ meetingOnboardingStatus: "completed" })).rejects.toThrow(
            "Storage unavailable",
        );
        expect(SettingsService.load()).toEqual(before);
    });

    it("persists and caches normalized model and speaker values", async () => {
        vi.spyOn(SettingsRepository.prototype, "getAll").mockResolvedValue([]);
        const saved = vi.spyOn(SettingsRepository.prototype, "save").mockImplementation(async (value) => value);
        const result = await SettingsService.save({
            meetingTranscription: {
                ...SettingsService.load().meetingTranscription,
                model: " tiny ",
                localSpeaker: " Allan ",
            },
        });
        expect(result.meetingTranscription.model).toBe("tiny");
        expect(SettingsService.load().meetingTranscription.localSpeaker).toBe("Allan");
        expect(JSON.parse(saved.mock.calls[0]?.[0].value ?? "{}")).toMatchObject({
            model: "tiny",
            localSpeaker: "Allan",
        });
    });

    it.each(["file:///tmp/audio", "https://key:secret@example.com/audio"])(
        "rejects unsafe meeting endpoint %s before persisting",
        async (endpoint) => {
            const save = vi.spyOn(SettingsRepository.prototype, "save");
            await expect(
                SettingsService.save({
                    meetingTranscription: {
                        ...SettingsService.load().meetingTranscription,
                        endpoint,
                    },
                }),
            ).rejects.toThrow();
            expect(save).not.toHaveBeenCalled();
        },
    );
});
