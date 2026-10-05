import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { AINoteEditProposal, AIWorkspaceData } from "@/store/repositories/electron/ai.repository";
import { WorkspaceProposalReview } from "./workspace-chat-details";

beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
        () =>
            ({
                font: "",
                measureText: () => ({ width: 8 }),
            }) as unknown as CanvasRenderingContext2D,
    );
});

afterAll(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

const proposal = (overrides: Partial<AINoteEditProposal> = {}): AINoteEditProposal => ({
    id: "proposal-1",
    noteId: "note-one",
    title: "Research note",
    rationale: "Add a concise summary of the findings.",
    baseMarkdown: "# Research\n\nOriginal text.",
    proposedMarkdown: "# Research\n\nUpdated text.",
    baseUpdatedAt: "2026-09-01T00:00:00.000Z",
    status: "pending",
    createdAt: "2026-09-29T00:00:00.000Z",
    ...overrides,
});

const data = (...proposals: AINoteEditProposal[]): AIWorkspaceData => ({ activities: [], sources: [], proposals });

function renderReview(
    proposals: AINoteEditProposal[],
    callbacks: {
        onApprove?: (proposal: AINoteEditProposal) => Promise<void>;
        onReject?: (proposal: AINoteEditProposal) => Promise<void>;
        approvalUnavailableReason?: string;
    } = {},
) {
    return render(
        <WorkspaceProposalReview
            data={data(...proposals)}
            onApprove={callbacks.onApprove ?? vi.fn().mockResolvedValue(undefined)}
            onReject={callbacks.onReject ?? vi.fn().mockResolvedValue(undefined)}
            approvalUnavailableReason={callbacks.approvalUnavailableReason}
            onBack={vi.fn()}
        />,
    );
}

describe("WorkspaceProposalReview", () => {
    it("shows the exact proposal diff and approves only the selected note", async () => {
        const first = proposal();
        const second = proposal({ id: "proposal-2", noteId: "note-two", title: "Second note" });
        const onApprove = vi.fn().mockResolvedValue(undefined);
        const onReject = vi.fn().mockResolvedValue(undefined);
        const view = renderReview([first, second], { onApprove, onReject });
        expect(screen.getByRole("heading", { level: 2, name: "Review proposed changes" })).toHaveFocus();

        expect(screen.getByRole("region", { name: "Markdown diff for Research note" })).toHaveTextContent("Original text.");
        expect(screen.getByRole("region", { name: "Markdown diff for Research note" })).toHaveTextContent("Updated text.");
        fireEvent.click(screen.getByRole("button", { name: /Second note/ }));
        fireEvent.click(screen.getByRole("button", { name: "Approve this note" }));
        await waitFor(() => expect(onApprove).toHaveBeenCalledWith(second));
        await waitFor(() => expect(screen.getByRole("heading", { level: 2, name: "Second note" })).toHaveFocus());
        expect(onReject).not.toHaveBeenCalled();

        view.rerender(
            <WorkspaceProposalReview data={data(first, proposal({ ...second, status: "approved" }))} onApprove={onApprove} onReject={onReject} onBack={vi.fn()} />,
        );
        expect(screen.getByText("This proposal was approved.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Approve this note" })).toBeDisabled();
    });

    it("uses a wrapped unified diff at narrow widths", () => {
        const mediaQuery = {
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        } as unknown as MediaQueryList;
        vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));

        renderReview([proposal()]);
        const diff = screen.getByRole("region", { name: "Markdown diff for Research note" });

        expect(diff.querySelector(".unified-diff-view-wrap")).not.toBeNull();
        expect(diff).toHaveTextContent("Original text.");
        expect(diff).toHaveTextContent("Updated text.");
    });

    it("keeps stale and rejected proposals visible but disables decisions", () => {
        const stale = proposal({ status: "stale" });
        const rejected = proposal({ id: "proposal-rejected", status: "rejected", title: "Rejected note" });
        const { onApprove, onReject } = { onApprove: vi.fn().mockResolvedValue(undefined), onReject: vi.fn().mockResolvedValue(undefined) };
        renderReview([stale, rejected], { onApprove, onReject });

        expect(screen.getByText(/A fresh review is required before it can be approved/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Approve this note" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Reject this note" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: /Rejected note/ }));
        expect(screen.getByText("This proposal was rejected.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Rejected note/ })).toHaveTextContent("Rejected");
        expect(onApprove).not.toHaveBeenCalled();
        expect(onReject).not.toHaveBeenCalled();
    });

    it("rejects one pending proposal independently", async () => {
        const pending = proposal();
        const onApprove = vi.fn().mockResolvedValue(undefined);
        const onReject = vi.fn().mockResolvedValue(undefined);
        renderReview([pending], { onApprove, onReject });

        fireEvent.click(screen.getByRole("button", { name: "Reject this note" }));
        await waitFor(() => expect(onReject).toHaveBeenCalledWith(pending));
        expect(onApprove).not.toHaveBeenCalled();
    });

    it("disables filesystem approval while leaving rejection available", async () => {
        const pending = proposal();
        const onApprove = vi.fn().mockResolvedValue(undefined);
        const onReject = vi.fn().mockResolvedValue(undefined);
        const reason = "Automatic approval is disabled for filesystem-backed notes.";

        renderReview([pending], { onApprove, onReject, approvalUnavailableReason: reason });

        const approveButton = screen.getByRole("button", { name: "Approve this note" });
        expect(screen.getByText(reason)).toHaveAttribute("role", "status");
        expect(approveButton).toBeDisabled();
        expect(approveButton).toHaveAttribute("aria-describedby", "proposal-approval-unavailable");
        expect(screen.getByRole("button", { name: "Reject this note" })).toBeEnabled();

        fireEvent.click(approveButton);
        expect(onApprove).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Reject this note" }));
        await waitFor(() => expect(onReject).toHaveBeenCalledWith(pending));
    });

    it("provides empty, loading, and error states", () => {
        const { rerender } = renderReview([]);
        expect(screen.getByText("No proposed changes")).toBeInTheDocument();

        rerender(<WorkspaceProposalReview data={data()} onApprove={vi.fn()} onReject={vi.fn()} onBack={vi.fn()} isLoading />);
        expect(screen.getByLabelText("Loading proposed changes")).toHaveAttribute("aria-busy", "true");

        rerender(<WorkspaceProposalReview data={data()} onApprove={vi.fn()} onReject={vi.fn()} onBack={vi.fn()} error="Could not load changes." />);
        expect(screen.getByRole("alert")).toHaveTextContent("Could not load changes.");
        expect(screen.queryByText("No proposed changes")).not.toBeInTheDocument();
    });

    it("recovers from a failed approval and reports disabled state", async () => {
        const failingApprove = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
        const current = proposal();
        const { rerender } = renderReview([current], { onApprove: failingApprove });
        fireEvent.click(screen.getByRole("button", { name: "Approve this note" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Try again.");
        fireEvent.click(screen.getByRole("button", { name: "Approve this note" }));
        await waitFor(() => expect(failingApprove).toHaveBeenCalledTimes(2));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();

        rerender(<WorkspaceProposalReview data={data(current)} onApprove={failingApprove} onReject={vi.fn()} onBack={vi.fn()} disabled />);
        expect(screen.getByRole("button", { name: "Approve this note" })).toBeDisabled();
    });
});
