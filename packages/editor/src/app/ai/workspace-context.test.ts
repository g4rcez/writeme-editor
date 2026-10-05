import { describe, expect, it } from "vitest";
import { buildWorkspaceContextSummary } from "./workspace-context";

describe("workspace context tool availability", () => {
    it("describes proposal review without implying automatic note writes", () => {
        const context = buildWorkspaceContextSummary(null, []);

        expect(context).toContain("proposeNoteEdit");
        expect(context).toContain("exact updatedAt");
        expect(context).toContain("stages a review proposal only");
        expect(context).toContain("never writes or changes a note");
    });

    it("warns the model when the selected adapter has no workspace tools", () => {
        const context = buildWorkspaceContextSummary(null, [], false);

        expect(context).toContain("workspace read and proposal tools are unavailable");
        expect(context).toContain("Do not claim to inspect, search, query, or propose edits");
        expect(context).not.toContain("Tools are available:");
    });
});
