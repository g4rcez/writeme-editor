import { describe, it, expect } from "vitest";
import { parseDocusaurusAdmonitions } from "./callout";

function makeRoot(html: string): HTMLDivElement {
  const doc = new DOMParser().parseFromString(
    `<body><div>${html}</div></body>`,
    "text/html",
  );
  return doc.body.firstElementChild as HTMLDivElement;
}

describe("parseDocusaurusAdmonitions", () => {
  it("converts :::note block to callout div", () => {
    const root = makeRoot(
      "<p>:::note</p><p>Some <strong>content</strong> here.</p><p>:::</p>",
    );
    parseDocusaurusAdmonitions(root);
    const callout = root.querySelector("div[data-type='callout']");
    expect(callout).not.toBeNull();
    expect(callout?.getAttribute("data-callout-type")).toBe("note");
    expect(callout?.querySelector("strong")?.textContent).toBe("content");
    const directPs = Array.from(root.children).filter(
      (el) => el.tagName === "P",
    );
    expect(directPs.length).toBe(0);
  });

  it("converts all five Docusaurus types", () => {
    for (const type of ["note", "tip", "info", "warning", "danger"] as const) {
      const root = makeRoot(`<p>:::${type}</p><p>body</p><p>:::</p>`);
      parseDocusaurusAdmonitions(root);
      const callout = root.querySelector("div[data-type='callout']");
      expect(callout?.getAttribute("data-callout-type")).toBe(type);
    }
  });

  it("removes the opening and closing marker paragraphs", () => {
    const root = makeRoot("<p>:::warning</p><p>text</p><p>:::</p>");
    parseDocusaurusAdmonitions(root);
    const paras = root.querySelectorAll("p");
    expect(paras.length).toBe(1);
    expect(paras[0]?.textContent).toBe("text");
  });

  it("handles multiple admonitions in sequence", () => {
    const root = makeRoot(
      "<p>:::note</p><p>first</p><p>:::</p><p>:::danger</p><p>second</p><p>:::</p>",
    );
    parseDocusaurusAdmonitions(root);
    const callouts = root.querySelectorAll("div[data-type='callout']");
    expect(callouts.length).toBe(2);
    expect(callouts[0]?.getAttribute("data-callout-type")).toBe("note");
    expect(callouts[1]?.getAttribute("data-callout-type")).toBe("danger");
  });

  it("ignores unknown types", () => {
    const root = makeRoot("<p>:::custom</p><p>body</p><p>:::</p>");
    parseDocusaurusAdmonitions(root);
    expect(root.querySelector("div[data-type='callout']")).toBeNull();
    expect(root.querySelectorAll("p").length).toBe(3);
  });

  it("handles multi-paragraph content inside the block", () => {
    const root = makeRoot(
      "<p>:::info</p><p>paragraph one</p><p>paragraph two</p><p>:::</p>",
    );
    parseDocusaurusAdmonitions(root);
    const callout = root.querySelector("div[data-type='callout']");
    expect(callout?.querySelectorAll("p").length).toBe(2);
  });

  it("does not affect content outside admonition blocks", () => {
    const root = makeRoot(
      "<p>before</p><p>:::tip</p><p>inside</p><p>:::</p><p>after</p>",
    );
    parseDocusaurusAdmonitions(root);
    const directPs = Array.from(root.children).filter(
      (el) => el.tagName === "P",
    );
    expect(directPs.length).toBe(2);
    expect(directPs[0]?.textContent).toBe("before");
    expect(directPs[1]?.textContent).toBe("after");
  });

  it("preserves all five Docusaurus types in round-trip", () => {
    const types = ["note", "tip", "info", "warning", "danger"] as const;
    for (const type of types) {
      const root = makeRoot(
        `<p>:::${type}</p><p>content for ${type}</p><p>:::</p>`,
      );
      parseDocusaurusAdmonitions(root);
      const callout = root.querySelector(`div[data-callout-type='${type}']`);
      expect(callout).not.toBeNull();
      expect(callout?.textContent?.trim()).toBe(`content for ${type}`);
    }
  });
});
