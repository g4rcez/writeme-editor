import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DomainLinkDisplay, getLinkTitleDomain } from "./domain-link";

describe("getLinkTitleDomain", () => {
  it.each([
    ["https://www.instagram.com/g4rcez/", "g4rcez"],
    [
      "https://github.com/g4rcez/writeme-editor/issues",
      "g4rcez/writeme-editor",
    ],
    ["https://youtube.com/@writeme/videos", "writeme"],
    ["https://x.com/g4rcez/status/1", "@g4rcez"],
    ["https://www.linkedin.com/in/g4rcez/details", "g4rcez"],
  ])("returns the domain-specific title for %s", (url, expected) => {
    expect(getLinkTitleDomain(url)).toBe(expected);
  });

  it("falls back to the hostname for unknown URL domains", () => {
    expect(getLinkTitleDomain("https://www.example.com/docs/page")).toBe(
      "example.com",
    );
  });

  it("falls back to the original value for invalid URLs", () => {
    expect(getLinkTitleDomain("not a url")).toBe("not a url");
  });

  it("uses the same title as DomainLinkDisplay", () => {
    const url = "https://github.com/g4rcez/writeme-editor";
    const { container } = render(<DomainLinkDisplay url={url} as="span" />);

    expect(container.textContent).toBe(getLinkTitleDomain(url));
  });
});
