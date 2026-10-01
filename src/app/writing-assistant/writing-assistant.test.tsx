import { history } from "@codemirror/commands";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIConfig } from "@/store/repositories/electron/ai.repository";
import { createMarkdownWritingAssistant } from "./markdown-adapter";
import type { WritingEditorAdapter, WritingSuggestion } from "./types";
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

function renderAssistant(adapter: WritingEditorAdapter) {
    return render(
        <MemoryRouter>
            <WritingAssistant adapter={adapter} />
        </MemoryRouter>,
    );
}

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });
    return { promise, resolve };
}

async function openPanel(): Promise<void> {
    fireEvent.click(screen.getByRole("button", { name: "Writing assistant" }));
    await screen.findByRole("combobox", { name: "Saved AI configuration" });
}

afterEach(() => {
    cleanup();
    adapters.splice(0).forEach((adapter) => adapter.dispose());
    views.splice(0).forEach((view) => view.destroy());
    document.body.replaceChildren();
});

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getConfigurations.mockResolvedValue([alternateConfiguration, defaultConfiguration]);
});

describe("WritingAssistant", () => {
    it("waits for an explicit review action, uses the saved default, and applies only on acceptance", async () => {
        const { view, adapter } = createMarkdownEditor("She go to school.");
        mocks.reviewWriting.mockResolvedValue([grammarSuggestion]);
        renderAssistant(adapter);

        expect(mocks.reviewWriting).not.toHaveBeenCalled();
        await openPanel();
        expect(mocks.reviewWriting).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: /Review note/ }));
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

    it("reviews only the captured selection when requested", async () => {
        const { adapter } = createMarkdownEditor("First sentence. Second sentence.", { from: 0, to: 5 });
        mocks.reviewWriting.mockResolvedValue([]);
        renderAssistant(adapter);

        expect(mocks.reviewWriting).not.toHaveBeenCalled();
        await openPanel();
        fireEvent.click(screen.getByRole("button", { name: /Review selection/ }));

        await waitFor(() => expect(mocks.reviewWriting).toHaveBeenCalledTimes(1));
        const [, segments] = mocks.reviewWriting.mock.calls[0] as [AIConfig, { text: string }[]];
        expect(segments.map((segment) => segment.text)).toEqual(["First"]);
        expect(screen.getByRole("status")).toHaveTextContent("No suggestions found in the reviewed text.");
    });

    it("aborts a pending review on Stop and ignores its late result", async () => {
        const { adapter } = createMarkdownEditor("She go to school.");
        const request = deferred<WritingSuggestion[]>();
        mocks.reviewWriting.mockReturnValue(request.promise);
        renderAssistant(adapter);
        await openPanel();

        fireEvent.click(screen.getByRole("button", { name: /Review note/ }));
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
        renderAssistant(adapter);
        await openPanel();

        fireEvent.click(screen.getByRole("button", { name: /Review note/ }));
        const signal = mocks.reviewWriting.mock.calls[0]?.[2] as AbortSignal;
        act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: " More." } }));
        expect(signal.aborted).toBe(true);

        await act(async () => request.resolve([grammarSuggestion]));
        expect(adapter.getSuggestions()).toEqual([]);
        expect(screen.getByRole("status")).toHaveTextContent("Text changed while reviewing. Review the updated text again.");
    });

    it("aborts on provider change and does not publish the prior provider's response", async () => {
        const { adapter } = createMarkdownEditor("She go to school.");
        const request = deferred<WritingSuggestion[]>();
        mocks.reviewWriting.mockReturnValue(request.promise);
        renderAssistant(adapter);
        await openPanel();

        fireEvent.click(screen.getByRole("button", { name: /Review note/ }));
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
        renderAssistant(adapter);
        await openPanel();
        fireEvent.click(screen.getByRole("button", { name: /Review note/ }));
        await screen.findByRole("article", { name: "Grammar suggestion 1 for go" });

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(adapter.getSuggestions()).toEqual([]);
        await waitFor(() => expect(view.dom.contains(document.activeElement)).toBe(true));
    });
    it("shows an empty prose state and disables review when the note contains only code", async () => {
        const { adapter } = createMarkdownEditor("```ts\nconst value = 1;\n```");
        renderAssistant(adapter);
        await openPanel();

        expect(screen.getByRole("status")).toHaveTextContent("No prose to review.");
        expect(screen.getByRole("button", { name: /Review note/ })).toBeDisabled();
        expect(mocks.reviewWriting).not.toHaveBeenCalled();
    });

    it("offers an explicit retry after a provider request fails", async () => {
        const { adapter } = createMarkdownEditor("She go to school.");
        mocks.reviewWriting.mockRejectedValueOnce(new Error("Provider is unavailable."));
        mocks.reviewWriting.mockResolvedValueOnce([grammarSuggestion]);
        renderAssistant(adapter);
        await openPanel();

        fireEvent.click(screen.getByRole("button", { name: /Review note/ }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Provider is unavailable.");
        expect(adapter.getSuggestions()).toEqual([]);
        fireEvent.click(screen.getByRole("button", { name: "Retry review" }));
        expect(await screen.findByRole("article", { name: "Grammar suggestion 1 for go" })).toBeInTheDocument();
        expect(mocks.reviewWriting).toHaveBeenCalledTimes(2);
    });

    it("closes with Escape and returns focus to the editor", async () => {
        const { view, adapter } = createMarkdownEditor("A complete sentence.");
        renderAssistant(adapter);
        await openPanel();

        fireEvent.keyDown(screen.getByRole("region", { name: "Writing suggestions" }), { key: "Escape" });

        expect(screen.queryByRole("region", { name: "Writing suggestions" })).not.toBeInTheDocument();
        await waitFor(() => expect(view.dom.contains(document.activeElement)).toBe(true));
    });
});
