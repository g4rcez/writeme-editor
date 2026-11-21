import { describe, it, expect } from "vitest";
import { identifyDomain } from "./url-utils";

describe("identifyDomain", () => {
    it("should read the id from watch URLs", () => {
        expect(identifyDomain("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3")?.id).toBe("dQw4w9WgXcQ");
    });

    it("should read the id from youtu.be URLs with a trailing slash", () => {
        expect(identifyDomain("https://youtu.be/dQw4w9WgXcQ/")?.id).toBe("dQw4w9WgXcQ");
    });

    it("should return null for other domains", () => {
        expect(identifyDomain("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    });
});
