import { describe, it, expect } from "vitest";
import {
  isValidUrl,
  isRelativeLink,
  convertToMarkdownLink,
  linkify,
} from "./link-utils";

describe("link-utils", () => {
  describe("isValidUrl", () => {
    it("should return true for valid absolute URLs", () => {
      expect(isValidUrl("https://google.com")).toBe(true);
      expect(isValidUrl("http://example.com/path?query=val#hash")).toBe(true);
      expect(isValidUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
        true,
      );
    });

    it("should return false for invalid absolute URLs", () => {
      expect(isValidUrl("not-a-url")).toBe(false);
      expect(isValidUrl("mailto:test@example.com")).toBe(false);
      expect(isValidUrl("ftp://test.com")).toBe(false);
      expect(isValidUrl("https:/invalid.com")).toBe(false);
    });
  });

  describe("isRelativeLink", () => {
    it("should return true for relative paths", () => {
      expect(isRelativeLink("./note.md")).toBe(true);
      expect(isRelativeLink("../folder/note.md")).toBe(true);
      expect(isRelativeLink("/absolute/like/path.md")).toBe(true);
      expect(isRelativeLink("./folder/")).toBe(true);
    });

    it("should return false for non-relative paths", () => {
      expect(isRelativeLink("just-a-file.md")).toBe(false);
      expect(isRelativeLink("https://google.com")).toBe(false);
      expect(isRelativeLink("note.md")).toBe(false);
    });
  });

  describe("convertToMarkdownLink", () => {
    it("should convert plain URLs to markdown links", () => {
      expect(convertToMarkdownLink("https://google.com")).toBe(
        "[https://google.com](https://google.com)",
      );
    });

    it("should convert relative paths to markdown links", () => {
      expect(convertToMarkdownLink("./note.md")).toBe("[./note.md](./note.md)");
    });

    it("should use the provided label", () => {
      expect(convertToMarkdownLink("https://google.com", "Google")).toBe(
        "[Google](https://google.com)",
      );
    });

    it("should not convert already formatted markdown links", () => {
      expect(convertToMarkdownLink("[text](https://google.com)")).toBe(
        "[text](https://google.com)",
      );
      expect(convertToMarkdownLink("![alt](./image.png)")).toBe(
        "![alt](./image.png)",
      );
    });

    it("should not convert random text", () => {
      expect(convertToMarkdownLink("Hello world")).toBe("Hello world");
    });
  });

  describe("linkify", () => {
    it("should convert plain URLs in mixed text", () => {
      const input =
        "Check this https://google.com and this http://example.com/path";
      const expected =
        "Check this [https://google.com](https://google.com) and this [http://example.com/path](http://example.com/path)";
      expect(linkify(input)).toBe(expected);
    });

    it("should convert relative paths in mixed text", () => {
      const input = "See ./note.md for details or ../folder/other.md";
      const expected =
        "See [./note.md](./note.md) for details or [../folder/other.md](../folder/other.md)";
      expect(linkify(input)).toBe(expected);
    });

    it("should not double-convert existing markdown links", () => {
      const input =
        "Check [Google](https://google.com) and https://example.com";
      const expected =
        "Check [Google](https://google.com) and [https://example.com](https://example.com)";
      expect(linkify(input)).toBe(expected);
    });

    it("should handle links with query parameters and fragments", () => {
      const input = "Visit https://google.com/search?q=test#top";
      const expected =
        "Visit [https://google.com/search?q=test#top](https://google.com/search?q=test#top)";
      expect(linkify(input)).toBe(expected);
    });

    it("should strip wrapping angle brackets", () => {
      expect(linkify("<https://google.com>")).toBe(
        "[https://google.com](https://google.com)",
      );
      expect(linkify("<./note.md>")).toBe("[./note.md](./note.md)");
    });

    it("should separate trailing punctuation from links", () => {
      expect(linkify("https://google.com.")).toBe(
        "[https://google.com](https://google.com).",
      );
      expect(linkify("Check https://google.com,")).toBe(
        "Check [https://google.com](https://google.com),",
      );
      expect(linkify("Visit https://google.com...")).toBe(
        "Visit [https://google.com](https://google.com)...",
      );
    });

    it("should handle wrapped links with punctuation", () => {
      expect(linkify("<https://google.com>.")).toBe(
        "[https://google.com](https://google.com).",
      );
      expect(linkify("Check <https://google.com>,")).toBe(
        "Check [https://google.com](https://google.com),",
      );
      expect(linkify("<https://google.com...>")).toBe(
        "[https://google.com](https://google.com)...",
      );
    });

    it("should handle paths starting with / followed by .md", () => {
      const input = "View /path/to/my/note.md";
      const expected = "View [/path/to/my/note.md](/path/to/my/note.md)";
      expect(linkify(input)).toBe(expected);
    });
  });
});
