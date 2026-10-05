import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceTools } from "./chat-tools";

const { getAll } = vi.hoisted(() => ({ getAll: vi.fn() }));

vi.mock("@/store/repositories", () => ({ repositories: { notes: { getAll } } }));

const note = {
    id: "note-1",
    title: "Research",
    content: "# Current\n\nExact body.",
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-05T06:07:08.000Z"),
    tags: ["research"],
    noteType: "note",
    filePath: "/workspace/research.md",
};

type ExecutableTool = { execute: (input: Record<string, unknown>) => Promise<unknown> };
async function execute(session: ReturnType<typeof createWorkspaceTools>, name: keyof typeof session.tools, input: Record<string, unknown>) {
    const candidate = session.tools[name] as unknown as Partial<ExecutableTool>;
    if (!candidate.execute) throw new Error(`Tool ${String(name)} is unavailable`);
    return candidate.execute(input);
}

describe("workspace tools", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getAll.mockResolvedValue([note]);
    });

    it("returns full Markdown and records deduplicated source activity", async () => {
        const snapshots: ReturnType<ReturnType<typeof createWorkspaceTools>["getWorkspaceData"]>[] = [];
        const session = createWorkspaceTools((data) => snapshots.push(data));

        const first = await execute(session, "readNote", { noteId: "note-1", includeContent: true }) as {
            success: boolean;
            result: { note: { content: string; updatedAt: string } };
        };
        await execute(session, "readNote", { noteId: "note-1", includeContent: true });

        expect(first.result.note.content).toBe("# Current\n\nExact body.");
        expect(first.result.note.updatedAt).toBe("2026-04-05T06:07:08.000Z");
        expect(first.result.note).not.toHaveProperty("filePath");
        expect(session.getWorkspaceData().sources).toStrictEqual([{ noteId: "note-1", title: "Research" }]);
        expect(session.getWorkspaceData().activities.map(({ toolName, status }) => ({ toolName, status }))).toStrictEqual([
            { toolName: "readNote", status: "complete" },
            { toolName: "readNote", status: "complete" },
        ]);
        expect(snapshots.some((data) => data.activities.some((activity) => activity.status === "running"))).toBe(true);
    });

    it("stages exact-base proposals only for the current version and never writes notes", async () => {
        const session = createWorkspaceTools();
        const result = await execute(session, "proposeNoteEdit", {
            noteId: "note-1",
            rationale: "Clarify the summary",
            proposedMarkdown: "# Revised\n\nNew body.",
            updatedAt: "2026-04-05T06:07:08.000Z",
        }) as { success: boolean; result: { proposal: Record<string, unknown> } };

        expect(result.success).toBe(true);
        expect(result.result.proposal).toMatchObject({
            noteId: "note-1",
            title: "Research",
            rationale: "Clarify the summary",
            baseUpdatedAt: "2026-04-05T06:07:08.000Z",
            baseMarkdown: "# Current\n\nExact body.",
            proposedMarkdown: "# Revised\n\nNew body.",
            status: "pending",
        });
        expect(session.getWorkspaceData().proposals).toHaveLength(1);
        expect(session.getWorkspaceData().sources).toStrictEqual([{ noteId: "note-1", title: "Research" }]);
    });

    it("does not read or stage proposals for notes outside the active workspace", async () => {
        const session = createWorkspaceTools();

        const read = await execute(session, "readNote", {
            noteId: "other-workspace-note",
            includeContent: true,
        }) as { success: boolean; result: { found: boolean } };
        const proposal = await execute(session, "proposeNoteEdit", {
            noteId: "other-workspace-note",
            rationale: "Try to stage",
            proposedMarkdown: "# Changed",
            updatedAt: "2026-04-05T06:07:08.000Z",
        }) as { success: boolean };

        expect(read).toMatchObject({ success: false, result: { found: false } });
        expect(proposal.success).toBe(false);
        expect(session.getWorkspaceData().proposals).toStrictEqual([]);
        expect(getAll).toHaveBeenCalled();
    });

    it.each([
        ["stale", { updatedAt: "2026-04-05T06:07:09.000Z", proposedMarkdown: "# Changed" }],
        ["no-op", { updatedAt: "2026-04-05T06:07:08.000Z", proposedMarkdown: "# Current\n\nExact body." }],
    ])("rejects %s proposals without staging", async (_case, override) => {
        const session = createWorkspaceTools();
        const input: Record<string, unknown> = {
            noteId: "note-1",
            rationale: "Reason",
            updatedAt: "2026-04-05T06:07:08.000Z",
            proposedMarkdown: "# Changed",
        };
        Object.assign(input, override);
        const result = await execute(session, "proposeNoteEdit", input) as { success: boolean };

        expect(result.success).toBe(false);
        expect(session.getWorkspaceData().proposals).toStrictEqual([]);
    });

    it("does not expose local note paths through structured queries", async () => {
        const session = createWorkspaceTools();
        const result = await execute(session, "runNotesQuery", {
            query: "SELECT filePath FROM notes",
            limit: 10,
        }) as { success: boolean; result: { rows: Record<string, unknown>[] } };

        expect(result.success).toBe(true);
        expect(result.result.rows).toHaveLength(1);
        expect(JSON.stringify(result.result.rows)).not.toContain(note.filePath);
    });

    it("prevents a second proposal for a note within one session", async () => {
        const session = createWorkspaceTools();
        const proposal = {
            noteId: "note-1",
            rationale: "Reason",
            proposedMarkdown: "New",
            updatedAt: "2026-04-05T06:07:08.000Z",
        };
        await execute(session, "proposeNoteEdit", proposal);
        const duplicate = await execute(session, "proposeNoteEdit", proposal) as { success: boolean };

        expect(duplicate.success).toBe(false);
        expect(session.getWorkspaceData().proposals).toHaveLength(1);
    });
});
