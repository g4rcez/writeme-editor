import { describe, expect, it } from "vitest";
import { Note, NoteType } from "@/store/note";
import {
    ensureReadItLaterFrontmatter,
    getReadItLaterState,
    isReadItLaterNote,
    isSafeHttpUrl,
    parseReadItLaterFeed,
    updateReadItLaterFrontmatter,
} from "./read-it-later-library";

describe("Read It Later frontmatter", () => {
    it("adds default read state without changing the note body", () => {
        const content = ensureReadItLaterFrontmatter("# An article\n\nText to read.");

        expect(content).toBe("---\nread: false\nstatus: inbox\n---\n\n# An article\n\nText to read.");
        expect(getReadItLaterState(content)).toEqual({ read: false, status: "inbox" });
    });

    it("preserves existing frontmatter and updates only library fields", () => {
        const content = "---\ntype: pdf\nview: pdf\nschemaVersion: 1\n---\n\nDocument data";
        const updated = updateReadItLaterFrontmatter(content, { read: true, status: "later" });

        expect(updated).toBe(
            "---\ntype: pdf\nview: pdf\nschemaVersion: 1\nread: true\nstatus: later\n---\n\nDocument data",
        );
        expect(getReadItLaterState(updated)).toEqual({ read: true, status: "later" });
    });

    it("keeps an existing blank frontmatter block and is idempotent", () => {
        const first = ensureReadItLaterFrontmatter("---\n\n---\n\nBody");

        expect(first).toBe(ensureReadItLaterFrontmatter(first));
        expect(first).toContain("read: false\nstatus: inbox");
        expect(first.endsWith("\n\nBody")).toBe(true);
    });

    it("uses the inbox default for an unknown stored status", () => {
        expect(getReadItLaterState("---\nread: true\nstatus: someday\n---\n\nBody")).toEqual({
            read: true,
            status: "inbox",
        });
    });
});

describe("Read It Later item detection", () => {
    it("includes saved articles and only PDFs explicitly imported to the library", () => {
        const article = Note.new("Article", "", NoteType["read-it-later"]);
        const ordinaryPdf = Note.new("PDF", "", NoteType.pdf);
        const savedPdf = Note.new("Saved PDF", "", NoteType.pdf, null, null, null, { readItLater: true });

        expect(isReadItLaterNote(article)).toBe(true);
        expect(isReadItLaterNote(ordinaryPdf)).toBe(false);
        expect(isReadItLaterNote(savedPdf)).toBe(true);
    });
});

describe("RSS and Atom feed parsing", () => {
    it("parses RSS article links, dates, summaries, and full content", () => {
        const xml = `<?xml version="1.0"?>
            <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
                <channel>
                    <title>Engineering Notes</title>
                    <item>
                        <title>First story</title>
                        <link>/stories/first</link>
                        <guid isPermaLink="false">story-1</guid>
                        <pubDate>Thu, 07 May 2026 00:00:00 GMT</pubDate>
                        <description><![CDATA[<p>A short summary.</p>]]></description>
                        <content:encoded><![CDATA[<article><p>Full story.</p></article>]]></content:encoded>
                    </item>
                </channel>
            </rss>`;

        expect(parseReadItLaterFeed(xml, "https://example.com/feed.xml")).toStrictEqual({
            title: "Engineering Notes",
            items: [
                {
                    id: "story-1",
                    title: "First story",
                    url: "https://example.com/stories/first",
                    publishedAt: "2026-05-07T00:00:00.000Z",
                    content: "<article><p>Full story.</p></article>",
                    description: "<p>A short summary.</p>",
                },
            ],
        });
    });

    it("parses Atom entries and prefers alternate links", () => {
        const xml = `<?xml version="1.0"?>
            <feed xmlns="http://www.w3.org/2005/Atom">
                <title>Atom Journal</title>
                <entry>
                    <title>Atom story</title>
                    <id>urn:entry:123</id>
                    <link rel="self" href="/api/entry/123" />
                    <link rel="alternate" href="/entry/123" />
                    <updated>2026-05-07T12:30:00Z</updated>
                    <content type="html">&lt;p&gt;Atom body.&lt;/p&gt;</content>
                </entry>
            </feed>`;

        expect(parseReadItLaterFeed(xml, "https://example.com/feed.xml").items[0]).toMatchObject({
            id: "urn:entry:123",
            title: "Atom story",
            url: "https://example.com/entry/123",
            publishedAt: "2026-05-07T12:30:00.000Z",
            content: "<p>Atom body.</p>",
        });
    });

    it("does not treat a non-URL RSS identifier as an article link", () => {
        const xml = "<rss><channel><item><title>Story</title><guid isPermaLink=\"false\">story-1</guid></item></channel></rss>";

        expect(parseReadItLaterFeed(xml, "https://example.com/feed.xml").items[0]?.url).toBeNull();
    });

    it("rejects malformed XML and feeds without entries", () => {
        expect(() => parseReadItLaterFeed("<rss><channel>", "https://example.com/feed.xml")).toThrow(
            "The feed returned invalid XML.",
        );
        expect(() => parseReadItLaterFeed("<rss><channel><title>Empty</title></channel></rss>", "https://example.com/feed.xml")).toThrow(
            "This URL did not return an RSS or Atom feed with entries.",
        );
    });
});

describe("safe feed URLs", () => {
    it.each(["https://example.com/feed.xml", "http://example.com/feed.xml"])("accepts %s", (url) => {
        expect(isSafeHttpUrl(url)).toBe(true);
    });

    it.each(["file:///tmp/feed.xml", "javascript:alert(1)", "https://user:pass@example.com/feed.xml"])(
        "rejects %s",
        (url) => {
            expect(isSafeHttpUrl(url)).toBe(false);
        },
    );
});
