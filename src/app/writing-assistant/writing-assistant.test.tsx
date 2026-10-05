import { history } from "@codemirror/commands";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIConfig } from "@/store/repositories/electron/ai.repository";
import type { WritingEditorAdapter, WritingSuggestion } from "./types";
import { createMarkdownWritingAssistant } from "./markdown-adapter";
import { WritingAssistant } from "./writing-assistant";

const mocks = vi.hoisted(() => ({
    getConfigurations: vi.fn(),
    reviewWriting: vi.fn(),
}));

vi.mock("@/store/global.store", () => ({
    repositories: { ai: { getConfigs: mocks.getConfigurations } },
}));

vi.mock("./review", () => ({
    reviewWriting: mocks.reviewWriting,
}));

const defaultConfiguration = {
    id: "config-default",
    name: "Private notes",
    systemPrompt: "Not used for writing review.",
    isDefault: true,
    adapterId: "openai",
    model: "review-model",
} satisfies AIConfig;

const alternateConfiguration = {
    ...defaultConfiguration,
    id: "config-alternate",
    name: "Local model",
    isDefault: false,
    adapterId: "ollama",
} satisfies AIConfig;

const grammarSuggestion: WritingSuggestion = {
    id: "suggestion-1",
    segmentId: "0",
    from: 4,
    to: 6,
    original: "go",
    replacement: "goes",
    category: "grammar",
    explanation: "Use the third-person singular form.",
};

const views: EditorView[] = [];
const adapters: WritingEditorAdapter[] = [];
const nativeReviewHandlers = new Set<() => void>();

function emitNativeReviewAction(): void {
    for (const handler of nativeReviewHandlers) handler();
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
}

function createMarkdownEditor(source: string, selection?: { from: number; to: number }) {
    const integration = createMarkdownWritingAssistant();
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
        parent,
        state: EditorState.create({
            doc: source,
            extensions: [integration.extension, history()],
        }),
    });
    if (selection) view.dispatch({ selection: EditorSelection.range(selection.from, selection.to) });
    const adapter = integration.createAdapter(view);
    views.push(view);
    adapters.push(adapter);
    return { view, adapter };
}

function renderAssistant(adapter: WritingEditorAdapter, view: EditorView) {
    return render(
        <MemoryRouter>
            <WritingAssistant
                adapter={adapter}
                selectionContext={{
                    target: view.dom,
                    readSelection: () => {
                        const { from, to } = view.state.selection.main;
                        return from < to ? { from, to } : null;
                    },
                    readAnchor: () => ({ left: 24, top: 24, bottom: 36 }),
                }}
            />
        </MemoryRouter>,
    );
}

function fireNativeImproveSelection(view: EditorView): void {
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    view.dom.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    emitNativeReviewAction();
}

async function reviewSelectedText(view: EditorView, selection?: { from: number; to: number }): Promise<void> {
    if (selection) {
        view.dispatch({ selection: EditorSelection.range(selection.from, selection.to) });
    } else if (view.state.selection.main.empty) {
        view.dispatch({ selection: EditorSelection.range(0, view.state.doc.length) });
    }
    fireNativeImproveSelection(view);
    await screen.findByRole("dialog", { name: "Writing suggestions" });
}
afterEach(() => {
    cleanup();
    adapters.splice(0).forEach((adapter) => adapter.dispose());
    views.splice(0).forEach((view) => view.destroy());
    nativeReviewHandlers.clear();
    Reflect.deleteProperty(window, "electronAPI");
    document.body.replaceChildren();
});

beforeEach(() => {
    vi.clearAllMocks();
    nativeReviewHandlers.clear();
    Object.defineProperty(window, "electronAPI", {
        configurable: true,
        value: {
            writingAssistant: {
                onImproveSelectedText(callback: () => void) {
                    nativeReviewHandlers.add(callback);
                    return () => nativeReviewHandlers.delete(callback);
                },
            },
        },
    });
    mocks.getConfigurations.mockResolvedValue([alternateConfiguration, defaultConfiguration]);
});

describe("WritingAssistant", () => {
    it("reviews the requested selection and applies suggestions only after acceptance", async () => {
        const { view, adapter } = createMarkdownEditor("She go to school.");
        mocks.reviewWriting.mockResolvedValue([grammarSuggestion]);
        renderAssistant(adapter, view);

        expect(mocks.reviewWriting).not.toHaveBeenCalled();
        expect(screen.queryByRole("button", { name: "Writing assistant" })).not.toBeInTheDocument();
        await reviewSelectedText(view);
        const card = await screen.findByRole("article", { name: "Grammar suggestion 1 for go" });
        expect(card.querySelector("del")).toHaveTextContent("go");
        expect(card.querySelector("ins")).toHaveTextContent("goes");
        expect(mocks.reviewWriting).toHaveBeenCalledWith(
            defaultConfiguration,
            expect.arrayContaining([expect.objectContaining({ text: "She go to school." })]),
            expect.any(AbortSignal),
            expect.any(Function),
        );
        expect(view.state.doc.toString()).toBe("She go to school.");

        fireEvent.click(screen.getByRole("button", { name: "Accept grammar suggestion 1 for go" }));
        await waitFor(() => expect(view.state.doc.toString()).toBe("She goes to school."));
    });
    it("offers a full-note review when selected text needs no changes", async () => {
        const { view, adapter } = createMarkdownEditor("First sentence. Second sentence.", { from: 0, to: 5 });
        mocks.reviewWriting.mockResolvedValue([]);
        renderAssistant(adapter, view);

        await reviewSelectedText(view);

        await waitFor(() => expect(mocks.reviewWriting).toHaveBeenCalledTimes(1));
        const [, selectedSegments] = mocks.reviewWriting.mock.calls[0] as [AIConfig, { text: string }[]];
        expect(selectedSegments.map((segment) => segment.text)).toEqual(["First"]);
        expect(await screen.findByRole("heading", { name: "Looks good" })).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("No meaningful changes suggested.");

        fireEvent.click(screen.getByRole("button", { name: "Review entire note" }));
        await waitFor(() => expect(mocks.reviewWriting).toHaveBeenCalledTimes(2));
        const [, fullNoteSegments] = mocks.reviewWriting.mock.calls[1] as [AIConfig, { text: string }[]];
        const fullNote = fullNoteSegments.map((segment) => segment.text).join(" ");
        expect(fullNote).toContain("First sentence.");
        expect(fullNote).toContain("Second sentence.");
    });

    it("keeps the native context menu available and ignores a collapsed cursor", () => {
        const { view, adapter } = createMarkdownEditor("Plain prose.");
        renderAssistant(adapter, view);

        fireNativeImproveSelection(view);

        expect(screen.queryByRole("dialog", { name: "Writing suggestions" })).not.toBeInTheDocument();
        expect(mocks.reviewWriting).not.toHaveBeenCalled();
    });

    it("does not use a stale editor selection for an outside context-menu action", () => {
        const { view, adapter } = createMarkdownEditor("Plain prose.", { from: 0, to: 5 });
        renderAssistant(adapter, view);

        fireEvent.contextMenu(view.dom);
        fireEvent.contextMenu(document.body);
        emitNativeReviewAction();

        expect(screen.queryByRole("dialog", { name: "Writing suggestions" })).not.toBeInTheDocument();
        expect(mocks.reviewWriting).not.toHaveBeenCalled();
    });

    it("aborts a pending review on Stop and ignores its late result", async () => {
        const { view, adapter } = createMarkdownEditor("She go to school.");
        const request = deferred<WritingSuggestion[]>();
        mocks.reviewWriting.mockReturnValue(request.promise);
        renderAssistant(adapter, view);
        await reviewSelectedText(view);

        await screen.findByRole("button", { name: "Stop review" });
        const signal = mocks.reviewWriting.mock.calls[0]?.[2] as AbortSignal;
        fireEvent.click(screen.getByRole("button", { name: "Stop review" }));
        expect(signal.aborted).toBe(true);

        await act(async () => request.resolve([grammarSuggestion]));
        expect(adapter.getSuggestions()).toEqual([]);
        expect(screen.queryByRole("article", { name: "Grammar suggestion 1 for go" })).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Review stopped.");
    });

    it("aborts immediately when the document changes during review", async () => {
        const { view, adapter } = createMarkdownEditor("She go to school.");
        const request = deferred<WritingSuggestion[]>();
        mocks.reviewWriting.mockReturnValue(request.promise);
        renderAssistant(adapter, view);
        await reviewSelectedText(view);
        await waitFor(() => expect(mocks.reviewWriting).toHaveBeenCalledTimes(1));

        const signal = mocks.reviewWriting.mock.calls[0]?.[2] as AbortSignal;
        act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: " More." } }));
        expect(signal.aborted).toBe(true);

        await act(async () => request.resolve([grammarSuggestion]));
        expect(adapter.getSuggestions()).toEqual([]);
        expect(screen.getByRole("status")).toHaveTextContent(
            "Text changed while reviewing. Review the updated text again.",
        );
    });

    it("aborts on provider change and does not publish the prior provider's response", async () => {
        const { view, adapter } = createMarkdownEditor("She go to school.");
        const request = deferred<WritingSuggestion[]>();
        mocks.reviewWriting.mockReturnValue(request.promise);
        renderAssistant(adapter, view);
        await reviewSelectedText(view);
        await waitFor(() => expect(mocks.reviewWriting).toHaveBeenCalledTimes(1));

        const signal = mocks.reviewWriting.mock.calls[0]?.[2] as AbortSignal;
        fireEvent.change(screen.getByRole("combobox", { name: "Saved AI configuration" }), {
            target: { value: alternateConfiguration.id },
        });
        expect(signal.aborted).toBe(true);

        await act(async () => request.resolve([grammarSuggestion]));
        expect(adapter.getSuggestions()).toEqual([]);
        expect(screen.getByRole("status")).toHaveTextContent("AI configuration changed. Run the review again.");
    });

    it("clears results and restores editor focus when the panel closes", async () => {
        const { view, adapter } = createMarkdownEditor("She go to school.");
        mocks.reviewWriting.mockResolvedValue([grammarSuggestion]);
        renderAssistant(adapter, view);
        await reviewSelectedText(view);
        await screen.findByRole("article", { name: "Grammar suggestion 1 for go" });

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(adapter.getSuggestions()).toEqual([]);
        await waitFor(() => expect(view.dom.contains(document.activeElement)).toBe(true));
    });

    it("reports when a selected code-only range has no reviewable prose", async () => {
        const { view, adapter } = createMarkdownEditor("```ts\nconst value = 1;\n```");
        renderAssistant(adapter, view);
        await reviewSelectedText(view);

        expect(await screen.findByText("No prose to review in this scope.")).toBeInTheDocument();
        expect(mocks.reviewWriting).not.toHaveBeenCalled();
    });

    it("offers an explicit retry after a provider request fails", async () => {
        const { view, adapter } = createMarkdownEditor("She go to school.");
        mocks.reviewWriting.mockRejectedValueOnce(new Error("Provider is unavailable."));
        mocks.reviewWriting.mockResolvedValueOnce([grammarSuggestion]);
        renderAssistant(adapter, view);
        await reviewSelectedText(view);

        expect(await screen.findByRole("alert")).toHaveTextContent("Provider is unavailable.");
        expect(adapter.getSuggestions()).toEqual([]);
        fireEvent.click(screen.getByRole("button", { name: "Retry review" }));
        expect(await screen.findByRole("article", { name: "Grammar suggestion 1 for go" })).toBeInTheDocument();
        expect(mocks.reviewWriting).toHaveBeenCalledTimes(2);
    });

    it("closes with Escape and returns focus to the editor", async () => {
        const { view, adapter } = createMarkdownEditor("A complete sentence.");
        mocks.reviewWriting.mockResolvedValue([]);
        renderAssistant(adapter, view);
        await reviewSelectedText(view);

        await screen.findByRole("heading", { name: "Looks good" });
        fireEvent.keyDown(screen.getByRole("dialog", { name: "Writing suggestions" }), { key: "Escape" });

        expect(screen.queryByRole("dialog", { name: "Writing suggestions" })).not.toBeInTheDocument();
        await waitFor(() => expect(view.dom.contains(document.activeElement)).toBe(true));
    });
});
