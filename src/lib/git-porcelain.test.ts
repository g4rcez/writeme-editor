import { describe, expect, it } from "vitest";
import { parsePorcelain } from "./git-porcelain";

describe("parsePorcelain", () => {
    it("returns clean tree for a header-only output", () => {
        const out = "## main...origin/main\n";
        expect(parsePorcelain(out)).toEqual({
            branch: "main",
            upstream: "origin/main",
            counts: {
                modified: 0,
                added: 0,
                deleted: 0,
                renamed: 0,
                untracked: 0,
                conflicted: 0,
            },
            hasChanges: false,
        });
    });

    it("parses no-upstream branch", () => {
        const out = "## feature/foo\n";
        const r = parsePorcelain(out);
        expect(r.branch).toBe("feature/foo");
        expect(r.upstream).toBeNull();
    });

    it("parses detached HEAD", () => {
        const out = "## HEAD (no branch)\n";
        const r = parsePorcelain(out);
        expect(r.branch).toBe("HEAD");
        expect(r.upstream).toBeNull();
    });

    it("ignores ahead/behind annotations on the header", () => {
        const out = "## main...origin/main [ahead 2, behind 1]\n";
        const r = parsePorcelain(out);
        expect(r.branch).toBe("main");
        expect(r.upstream).toBe("origin/main");
    });

    it("counts modified, added, deleted, renamed, untracked", () => {
        const out = [
            "## main...origin/main",
            " M src/a.ts",
            "M  src/b.ts",
            "A  src/c.ts",
            " D src/d.ts",
            "D  src/e.ts",
            "R  old.ts -> new.ts",
            "?? src/f.ts",
            "",
        ].join("\n");
        const r = parsePorcelain(out);
        expect(r.counts).toEqual({
            modified: 2,
            added: 1,
            deleted: 2,
            renamed: 1,
            untracked: 1,
            conflicted: 0,
        });
        expect(r.hasChanges).toBe(true);
    });

    it("counts conflicts when either side contains U", () => {
        const out = ["## main...origin/main", "UU src/a.ts", "AU src/b.ts", "UD src/c.ts", ""].join("\n");
        expect(parsePorcelain(out).counts.conflicted).toBe(3);
    });
});
