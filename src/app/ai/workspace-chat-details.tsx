import { Button, css } from "@g4rcez/components";
import {
    CaretDownIcon,
    CheckCircleIcon,
    ClockIcon,
    MagnifyingGlassIcon,
    NoteIcon,
    WarningCircleIcon,
    WrenchIcon,
} from "@phosphor-icons/react";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useEffect, useRef, useState } from "react";
import type {
    AINoteEditProposal,
    AIWorkspaceActivity,
    AIWorkspaceData,
} from "@/store/repositories/electron/ai.repository";
import { AIDiffView } from "./ai-diff-view";

const activityIcons = {
    listNotes: NoteIcon,
    readNote: NoteIcon,
    searchNotes: MagnifyingGlassIcon,
    runNotesQuery: MagnifyingGlassIcon,
    proposeNoteEdit: WrenchIcon,
} satisfies Record<AIWorkspaceActivity["toolName"], typeof NoteIcon>;

function ActivityStatus({ activity }: { activity: AIWorkspaceActivity }) {
    const Icon =
        activity.status === "error" ? WarningCircleIcon : activity.status === "running" ? ClockIcon : CheckCircleIcon;
    const statusLabel =
        activity.status === "running" ? "In progress" : activity.status === "error" ? "Failed" : "Complete";

    return (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Icon aria-hidden="true" size={14} />
            {statusLabel}
        </span>
    );
}

export function WorkspaceChatDetails({
    data,
    messageId,
    onOpenSource,
    onReview,
}: {
    data: AIWorkspaceData;
    messageId: string;
    onOpenSource: (noteId: string) => void;
    onReview: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const activityHeadingId = `ai-research-activity-heading-${messageId}`;
    const sourcesHeadingId = `ai-research-sources-heading-${messageId}`;
    const activityCount = data.activities.length;
    const sourceCount = data.sources.length;
    const activeActivity = data.activities.find((activity) => activity.status === "running");
    const summary = [
        activityCount ? `${activityCount} ${activityCount === 1 ? "tool" : "tools"}` : null,
        sourceCount ? `${sourceCount} ${sourceCount === 1 ? "source" : "sources"}` : null,
        activeActivity?.label,
    ]
        .filter(Boolean)
        .join(" · ");

    return (
        <section aria-label="Research summary" className="min-w-0">
            <header className="flex flex-wrap items-center gap-2">
                <button
                    aria-expanded={expanded}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-sm text-left text-sm text-muted-foreground motion-safe:transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setExpanded((current) => !current)}
                    type="button"
                >
                    <span className="shrink-0 font-semibold text-foreground">Research</span>
                    <span
                        aria-atomic="true"
                        aria-live={activeActivity ? "polite" : undefined}
                        className="min-w-0 truncate"
                    >
                        {summary || "No workspace activity"}
                    </span>
                    <CaretDownIcon
                        aria-hidden="true"
                        className={css(
                            "size-4 shrink-0 text-muted-foreground motion-safe:transition-transform",
                            expanded && "rotate-180",
                        )}
                    />
                </button>
                {data.proposals.length > 0 ? (
                    <Button id={`review-changes-${messageId}`} onClick={onReview} size="small" theme="secondary">
                        Review changes ({data.proposals.length})
                    </Button>
                ) : null}
            </header>
            {sourceCount ? (
                <section aria-labelledby={sourcesHeadingId} className="mt-3 min-w-0">
                    <h3 className="mb-2 text-xs font-semibold text-foreground" id={sourcesHeadingId}>
                        Sources
                    </h3>
                    <ul className="flex flex-wrap gap-2">
                        {data.sources.map((source) => (
                            <li key={source.noteId}>
                                <button
                                    className="inline-flex min-h-11 max-w-full min-w-0 items-center gap-2 rounded-md border border-card-border bg-secondary-background px-3 py-2 text-left text-sm text-foreground motion-safe:transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    onClick={() => onOpenSource(source.noteId)}
                                    type="button"
                                >
                                    <NoteIcon aria-hidden="true" className="shrink-0 text-primary" size={15} />
                                    <span className="break-words">{source.title}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
            {expanded ? (
                <div className="mt-3 border-t border-card-border/70 pt-3">
                    <section aria-labelledby={activityHeadingId} className="min-w-0">
                        <h3 className="mb-2 text-xs font-semibold text-foreground" id={activityHeadingId}>
                            Tool activity
                        </h3>
                        {activityCount ? (
                            <ul className="space-y-2">
                                {data.activities.map((activity) => {
                                    const Icon = activityIcons[activity.toolName];
                                    return (
                                        <li
                                            className="flex min-w-0 items-start justify-between gap-3 text-sm"
                                            key={activity.id}
                                        >
                                            <span className="flex min-w-0 items-start gap-2">
                                                <Icon
                                                    aria-hidden="true"
                                                    className="mt-0.5 shrink-0 text-muted-foreground"
                                                    size={15}
                                                />
                                                <span className="break-words">{activity.label}</span>
                                            </span>
                                            <ActivityStatus activity={activity} />
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground">No tools were used for this response.</p>
                        )}
                    </section>
                    {sourceCount ? null : (
                        <section aria-labelledby={sourcesHeadingId} className="mt-4">
                            <h3 className="mb-2 text-xs font-semibold text-foreground" id={sourcesHeadingId}>
                                Sources
                            </h3>
                            <p className="text-sm text-muted-foreground">No source notes were opened.</p>
                        </section>
                    )}
                </div>
            ) : null}
        </section>
    );
}

type ReviewAction = "approve" | "reject";

function ProposalStatus({ status }: { status: AINoteEditProposal["status"] }) {
    const styles: Record<AINoteEditProposal["status"], string> = {
        pending: "text-warning",
        approved: "text-success",
        rejected: "text-muted-foreground",
        stale: "text-danger",
    };

    return (
        <span className={`shrink-0 text-xs font-medium ${styles[status]}`}>
            {status === "pending" ? "Pending review" : status[0]?.toUpperCase() + status.slice(1)}
        </span>
    );
}

export function WorkspaceProposalReview({
    data,
    onApprove,
    onReject,
    onBack,
    approvalUnavailableReason,
    isLoading = false,
    error,
    disabled = false,
}: {
    data: AIWorkspaceData;
    onApprove: (proposal: AINoteEditProposal) => Promise<void>;
    onReject: (proposal: AINoteEditProposal) => Promise<void>;
    onBack: () => void;
    isLoading?: boolean;
    error?: string | null;
    approvalUnavailableReason?: string;
    disabled?: boolean;
}) {
    const [selectedId, setSelectedId] = useState<string | null>(data.proposals[0]?.id ?? null);
    const [pendingAction, setPendingAction] = useState<{ proposalId: string; action: ReviewAction } | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const headingRef = useRef<HTMLHeadingElement | null>(null);
    const proposalTitleRef = useRef<HTMLHeadingElement | null>(null);
    const selectedProposal = data.proposals.find((proposal) => proposal.id === selectedId) ?? data.proposals[0];
    const isBusy = disabled || pendingAction !== null;

    useEffect(() => {
        headingRef.current?.focus();
    }, []);

    const handleDecision = async (proposal: AINoteEditProposal, action: ReviewAction) => {
        if (isBusy || proposal.status !== "pending") return;

        setPendingAction({ proposalId: proposal.id, action });
        setActionError(null);
        try {
            await (action === "approve" ? onApprove(proposal) : onReject(proposal));
            proposalTitleRef.current?.focus();
        } catch {
            setActionError(`Could not ${action} the proposal for “${proposal.title}”. Try again.`);
        } finally {
            setPendingAction(null);
        }
    };

    return (
        <section
            aria-labelledby="workspace-proposal-review-heading"
            className="flex min-h-0 w-full flex-col gap-4 p-4 sm:p-6"
        >
            <header className="flex flex-wrap items-start gap-3">
                <Button aria-label="Back to chat" onClick={onBack} size="icon" theme="ghost-neutral">
                    <ArrowLeftIcon aria-hidden="true" size={18} />
                </Button>
                <div className="min-w-0 flex-1">
                    <h2
                        className="text-lg font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        id="workspace-proposal-review-heading"
                        ref={headingRef}
                        tabIndex={-1}
                    >
                        Review proposed changes
                    </h2>
                </div>
            </header>

            {error ? (
                <p
                    className="rounded-md border border-danger/40 bg-danger-subtle px-3 py-2 text-sm text-danger"
                    role="alert"
                >
                    {error}
                </p>
            ) : null}
            {actionError ? (
                <p
                    className="rounded-md border border-danger/40 bg-danger-subtle px-3 py-2 text-sm text-danger"
                    role="alert"
                >
                    {actionError}
                </p>
            ) : null}
            {disabled && !pendingAction ? (
                <p className="text-sm text-muted-foreground" role="status">
                    Review actions are currently unavailable.
                </p>
            ) : null}

            {isLoading ? (
                <div
                    aria-busy="true"
                    aria-label="Loading proposed changes"
                    className="grid gap-4 md:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.6fr)]"
                >
                    <div className="h-40 rounded-md bg-muted motion-safe:animate-pulse" />
                    <div className="h-64 rounded-md bg-muted motion-safe:animate-pulse" />
                </div>
            ) : error && data.proposals.length === 0 ? (
                <section className="rounded-md border border-floating-border px-4 py-8 text-center">
                    <h2 className="font-medium text-foreground">Unable to load proposed changes</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Return to chat and open the review again to retry.
                    </p>
                </section>
            ) : data.proposals.length === 0 ? (
                <section className="rounded-md border border-floating-border px-4 py-8 text-center">
                    <h2 className="font-medium text-foreground">No proposed changes</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        When the assistant proposes an edit to a note, you can review it here.
                    </p>
                </section>
            ) : (
                <div className="grid min-h-0 gap-5 md:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.6fr)]">
                    <nav aria-label="Proposed notes" className="min-w-0">
                        <h2 className="mb-2 text-sm font-semibold text-foreground">Notes ({data.proposals.length})</h2>
                        <ul className="flex flex-col gap-1">
                            {data.proposals.map((proposal) => (
                                <li key={proposal.id}>
                                    <button
                                        aria-pressed={selectedProposal?.id === proposal.id}
                                        className="flex min-h-12 w-full min-w-0 items-start justify-between gap-2 rounded-md px-3 py-2 text-left motion-safe:transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-muted"
                                        onClick={() => {
                                            setSelectedId(proposal.id);
                                            setActionError(null);
                                        }}
                                        type="button"
                                    >
                                        <span className="min-w-0">
                                            <span className="block break-words text-sm font-medium text-foreground">
                                                {proposal.title}
                                            </span>
                                            <span className="mt-1 block break-all text-xs text-muted-foreground">
                                                {proposal.noteId}
                                            </span>
                                        </span>
                                        <ProposalStatus status={proposal.status} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    {selectedProposal ? (
                        <section aria-label={`Review ${selectedProposal.title}`} className="min-w-0 space-y-4">
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h2
                                        className="break-words text-base font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        ref={proposalTitleRef}
                                        tabIndex={-1}
                                    >
                                        {selectedProposal.title}
                                    </h2>
                                    <ProposalStatus status={selectedProposal.status} />
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                                    {selectedProposal.rationale}
                                </p>
                            </div>

                            {selectedProposal.status === "stale" ? (
                                <p
                                    className="rounded-md border border-warning/40 bg-warning-subtle px-3 py-2 text-sm text-warning"
                                    role="status"
                                >
                                    This note has changed since the proposal was created. A fresh review is required
                                    before it can be approved.
                                </p>
                            ) : selectedProposal.status === "approved" ? (
                                <p className="text-sm text-success" role="status">
                                    This proposal was approved.
                                </p>
                            ) : selectedProposal.status === "rejected" ? (
                                <p className="text-sm text-muted-foreground" role="status">
                                    This proposal was rejected.
                                </p>
                            ) : null}
                            {selectedProposal.status === "pending" && approvalUnavailableReason ? (
                                <p
                                    className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
                                    id="proposal-approval-unavailable"
                                    role="status"
                                >
                                    {approvalUnavailableReason}
                                </p>
                            ) : null}
                            {pendingAction?.proposalId === selectedProposal.id ? (
                                <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
                                    {pendingAction.action === "approve" ? "Approving" : "Rejecting"}{" "}
                                    {selectedProposal.title}…
                                </p>
                            ) : null}

                            <section aria-label={`Markdown diff for ${selectedProposal.title}`} className="min-w-0">
                                <h3 className="mb-2 text-sm font-medium text-foreground">Exact Markdown changes</h3>
                                <AIDiffView
                                    oldContent={selectedProposal.baseMarkdown}
                                    newContent={selectedProposal.proposedMarkdown}
                                />
                            </section>

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    disabled={
                                        isBusy ||
                                        selectedProposal.status !== "pending" ||
                                        Boolean(approvalUnavailableReason)
                                    }
                                    aria-describedby={
                                        selectedProposal.status === "pending" && approvalUnavailableReason
                                            ? "proposal-approval-unavailable"
                                            : undefined
                                    }
                                    loading={
                                        pendingAction?.proposalId === selectedProposal.id &&
                                        pendingAction.action === "approve"
                                    }
                                    onClick={() => void handleDecision(selectedProposal, "approve")}
                                    theme="primary"
                                >
                                    <CheckIcon aria-hidden="true" size={16} />
                                    Approve this note
                                </Button>
                                <Button
                                    disabled={isBusy || selectedProposal.status !== "pending"}
                                    loading={
                                        pendingAction?.proposalId === selectedProposal.id &&
                                        pendingAction.action === "reject"
                                    }
                                    onClick={() => void handleDecision(selectedProposal, "reject")}
                                    theme="secondary"
                                >
                                    <XIcon aria-hidden="true" size={16} />
                                    Reject this note
                                </Button>
                            </div>
                        </section>
                    ) : null}
                </div>
            )}
        </section>
    );
}
