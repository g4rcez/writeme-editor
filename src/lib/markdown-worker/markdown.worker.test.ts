import { describe, expect, it } from "vitest";
import { processMarkdown } from "./markdown.worker";

describe("processMarkdown", () => {
  it("converts a markdown heading to an HTML h1", () => {
    const html = processMarkdown("# Hello");
    expect(html).toContain("<h1");
    expect(html).toContain("Hello");
  });

  it("converts a markdown paragraph to an HTML p", () => {
    const html = processMarkdown("Hello world");
    expect(html).toContain("<p");
    expect(html).toContain("Hello world");
  });

  it("converts a fenced code block", () => {
    const html = processMarkdown("```ts\nconst x = 1;\n```");
    expect(html).toContain("<code");
    expect(html).toContain("const x = 1;");
  });

  it("strips common leading indentation before parsing", () => {
    const html = processMarkdown("  # Indented heading");
    expect(html).toContain("<h1");
  });

  it("returns a non-empty string for empty input", () => {
    const html = processMarkdown("");
    expect(typeof html).toBe("string");
  });
});
