import { describe, expect, it } from "vitest";
import { SettingsSchema } from "./settings.schema";

describe("Read It Later feed settings", () => {
    it("defaults to no subscribed feeds for existing settings", () => {
        expect(SettingsSchema.parse({}).readItLaterFeeds).toEqual([]);
    });

    it("accepts safe HTTP feeds and rejects unsupported or credentialed URLs", () => {
        const feed = {
            id: "feed-1",
            title: "Example feed",
            lastFetchedAt: null,
        };

        expect(
            SettingsSchema.parse({ readItLaterFeeds: [{ ...feed, url: "https://example.com/feed.xml" }] })
                .readItLaterFeeds,
        ).toMatchObject([{ ...feed, url: "https://example.com/feed.xml" }]);
        expect(() =>
            SettingsSchema.parse({ readItLaterFeeds: [{ ...feed, url: "file:///tmp/feed.xml" }] }),
        ).toThrow();
        expect(() =>
            SettingsSchema.parse({ readItLaterFeeds: [{ ...feed, url: "https://user:pass@example.com/feed.xml" }] }),
        ).toThrow();
    });
});
