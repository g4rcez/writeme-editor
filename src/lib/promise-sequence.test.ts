import { describe, expect, it } from "vitest";
import { promiseSequence } from "./promise-sequence";

describe("promiseSequence", () => {
    it("runs promise factories in order and returns their resolved values", async () => {
        const events: string[] = [];

        const result = await promiseSequence([
            async () => {
                events.push("first:start");
                await Promise.resolve();
                events.push("first:end");
                return 1;
            },
            async () => {
                events.push("second:start");
                await Promise.resolve();
                events.push("second:end");
                return 2;
            },
        ]);

        expect(result).toEqual([1, 2]);
        expect(events).toEqual(["first:start", "first:end", "second:start", "second:end"]);
    });
});
