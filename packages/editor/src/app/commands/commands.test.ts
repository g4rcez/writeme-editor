import { describe, expect, it } from "vitest";
import { FrontmatterCommand, UuidCommand } from "./commands";

describe("UuidCommand", () => {
    it("matches the UUID command instead of the date command", () => {
        expect(UuidCommand.find.test(">>uuid ")).toBe(true);
        expect(UuidCommand.find.test(">>date ")).toBe(false);
    });
});

describe("FrontmatterCommand", () => {
    it("matches the frontmatter text command", () => {
        expect(FrontmatterCommand.trigger).toBe(">>-- ");
        expect(FrontmatterCommand.find.test(">>-- ")).toBe(true);
        expect(FrontmatterCommand.find.test(">>— ")).toBe(true);
        expect(FrontmatterCommand.find.test(">>--")).toBe(true);
    });
});
