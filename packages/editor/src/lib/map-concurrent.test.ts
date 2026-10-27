import { describe, expect, it } from "vitest";
import { mapConcurrent } from "./map-concurrent";

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe("mapConcurrent", () => {
    it("never runs more than the limit at once and keeps the input order", async () => {
        let running = 0;
        let peak = 0;
        const results = await mapConcurrent(
            Array.from({ length: 50 }, (_, index) => index),
            5,
            async (value) => {
                running += 1;
                peak = Math.max(peak, running);
                await tick();
                running -= 1;
                return value * 2;
            },
        );
        expect(peak).toBe(5);
        expect(results).toEqual(Array.from({ length: 50 }, (_, index) => index * 2));
    });

    it("handles empty input and limits larger than the input", async () => {
        expect(await mapConcurrent([], 4, async (value: number) => value)).toEqual([]);
        expect(await mapConcurrent([1, 2], 100, async (value) => value + 1)).toEqual([2, 3]);
    });

    it("rejects when a call rejects", async () => {
        await expect(
            mapConcurrent([1, 2, 3], 2, async (value) => {
                if (value === 2) throw new Error("boom");
                return value;
            }),
        ).rejects.toThrow("boom");
    });
});
