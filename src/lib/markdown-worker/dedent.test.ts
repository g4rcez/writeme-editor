import { describe, expect, it } from "vitest";
import { dedent } from "./dedent";

describe("dedent", () => {
  it("returns unchanged text with no common indent", () => {
    expect(dedent("hello\nworld")).toBe("hello\nworld");
  });

  it("strips uniform leading spaces", () => {
    expect(dedent("  hello\n  world")).toBe("hello\nworld");
  });

  it("preserves relative indentation", () => {
    expect(dedent("  hello\n    world")).toBe("hello\n  world");
  });

  it("ignores blank lines when computing minimum indent", () => {
    expect(dedent("  hello\n\n  world")).toBe("hello\n\nworld");
  });

  it("returns text as-is when all lines are blank", () => {
    expect(dedent("\n\n")).toBe("\n\n");
  });
});
