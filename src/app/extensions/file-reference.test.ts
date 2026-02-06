import { describe, it, expect } from "vitest";
import { FileReference } from "./file-reference";

describe("FileReference Extension", () => {
  it("should be defined", () => {
    expect(FileReference).toBeDefined();
  });

  it("should have the correct name", () => {
    expect(FileReference.name).toBe("fileReference");
  });

  // Regex testing would go here once we expose it
});
