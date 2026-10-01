import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AIWorkspaceData } from "@/store/repositories/electron/ai.repository";
import { WorkspaceChatDetails } from "./workspace-chat-details";

const workspaceData: AIWorkspaceData = {
    activities: [
        { id: "activity-1", toolName: "searchNotes", label: "Searched notes for project plans", status: "complete" },
        { id: "activity-2", toolName: "readNote", label: "Reading roadmap.md", status: "running" },
        { id: "activity-3", toolName: "runNotesQuery", label: "Workspace query failed", status: "error" },
    ],
    sources: [{ noteId: "note-roadmap", title: "Roadmap" }],
    proposals: [
        {
            id: "proposal-1",
            noteId: "note-roadmap",
            title: "Roadmap",
            rationale: "Clarify the milestones.",
            baseMarkdown: "# Roadmap",
            proposedMarkdown: "# Roadmap\n\n## Milestones",
            baseUpdatedAt: "2026-09-01T00:00:00.000Z",
            status: "pending",
            createdAt: "2026-09-29T00:00:00.000Z",
        },
    ],
};

describe("WorkspaceChatDetails", () => {
    it("starts collapsed and reveals activity, statuses, and source links on demand", () => {
        const onOpenSource = vi.fn();
        const { getByRole } = render(<WorkspaceChatDetails data={workspaceData} messageId="message-1" onOpenSource={onOpenSource} onReview={vi.fn()} />);

        expect(getByRole("button", { name: /Research/ })).toHaveAttribute("aria-expanded", "false");
        expect(screen.getByText(/Reading roadmap.md/)).toBeInTheDocument();
        expect(screen.queryByText("Searched notes for project plans")).not.toBeInTheDocument();
        fireEvent.click(getByRole("button", { name: /Research/ }));

        expect(screen.getByText("Searched notes for project plans")).toBeInTheDocument();
        expect(screen.getByText("In progress")).toBeInTheDocument();
        expect(screen.getByText("Failed")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Roadmap" }));
        expect(onOpenSource).toHaveBeenCalledWith("note-roadmap");
    });

    it("offers one review action for proposals and describes empty activity", () => {
        const onReview = vi.fn();
        const data: AIWorkspaceData = { activities: [], sources: [], proposals: workspaceData.proposals };
        const { rerender } = render(<WorkspaceChatDetails data={data} messageId="message-1" onOpenSource={vi.fn()} onReview={onReview} />);

        fireEvent.click(screen.getByRole("button", { name: "Review changes (1)" }));
        expect(screen.getByRole("button", { name: "Review changes (1)" })).toHaveAttribute("id", "review-changes-message-1");
        expect(onReview).toHaveBeenCalledOnce();
        expect(screen.getAllByRole("button", { name: "Review changes (1)" })).toHaveLength(1);

        const noProposals = { ...data, proposals: [] };
        rerender(<WorkspaceChatDetails data={noProposals} messageId="message-1" onOpenSource={vi.fn()} onReview={onReview} />);
        expect(screen.queryByRole("button", { name: /Review changes/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /Research/ }));
        expect(screen.getByText("No tools were used for this response.")).toBeInTheDocument();
        expect(screen.getByText("No source notes were opened.")).toBeInTheDocument();
    });
});
