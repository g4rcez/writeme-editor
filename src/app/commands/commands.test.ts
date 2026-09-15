import { describe, expect, it } from "vitest";
import { UuidCommand } from "./commands";

describe("UuidCommand", () => {
    it("matches the UUID command instead of the date command", () => {
        expect(UuidCommand.find.test(">>uuid ")).toBe(true);
        expect(UuidCommand.find.test(">>date ")).toBe(false);
    });
});
