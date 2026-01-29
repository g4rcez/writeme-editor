import { describe, it, expect } from "vitest";
import { formatSimplifiedPath } from "./file-utils";

describe("file-utils", () => {
  describe("formatSimplifiedPath", () => {
    it("should return the path as is if it has 3 or fewer segments", () => {
      expect(formatSimplifiedPath("A/B/C")).toBe("A / B / C");
      expect(formatSimplifiedPath("A/B")).toBe("A / B");
      expect(formatSimplifiedPath("A")).toBe("A");
    });

    it("should truncate middle segments if it has more than 3 segments", () => {
      expect(formatSimplifiedPath("A/B/C/D")).toBe("A / ... / C / D");
      expect(formatSimplifiedPath("A/B/C/D/E")).toBe("A / ... / D / E");
    });
    
    it("should handle empty strings", () => {
        expect(formatSimplifiedPath("")).toBe("");
    });
  });
});
