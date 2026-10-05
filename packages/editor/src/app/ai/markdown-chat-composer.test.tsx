import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AIAdapter } from "./adapters/types";
import { AI_FILE_CAPABILITIES } from "./adapters/types";
import { MarkdownChatComposer } from "./markdown-chat-composer";

const mocks = vi.hoisted(() => ({
    markdown: "",
    html: "",
    handlePaste: vi.fn(),
    onUpdate: vi.fn(),
    setContent: vi.fn(),
    setEditable: vi.fn(),
}));

vi.mock("@/app/extensions", () => ({ createExtensions: () => [] }));
vi.mock("@/app/elements/code-block", () => ({ getThemeForMode: () => "light" }));
vi.mock("@tiptap/react", async () => {
    const React = await import("react");
    return {
        useEditor: (options: {
            editorProps: { handlePaste: (view: unknown, event: ClipboardEvent) => boolean };
            onUpdate: (args: { editor: { getHTML: () => string } }) => void;
        }) => {
            mocks.handlePaste.mockImplementation((event: ClipboardEvent) => options.editorProps.handlePaste({}, event));
            mocks.onUpdate.mockImplementation(options.onUpdate);
            return {
                storage: {},
                getMarkdown: () => mocks.markdown,
                getHTML: () => mocks.html,
                setEditable: mocks.setEditable,
                commands: {
                    setContent: (content: string) => {
                        mocks.setContent(content);
                        mocks.html = content;
                        mocks.markdown = content.replace(/<\/?[^>]+>/g, "").trim();
                    },
                },
            };
        },
        EditorContent: () => React.createElement("div", { role: "textbox", "aria-label": "Message Workspace AI" }),
    };
});

type ComposerProps = ComponentProps<typeof MarkdownChatComposer>;

const adapter: AIAdapter = {
    id: "test",
    name: "Test provider",
    supportsFiles: true,
    fileCapabilities: AI_FILE_CAPABILITIES.anthropic,
    supportsOAuth: false,
    defaultModel: "test",
    async auth() {
        return {};
    },
    async refresh(credentials) {
        return credentials;
    },
    isExpired() {
        return false;
    },
    async listModels() {
        return [];
    },
    async prepareFile(file) {
        return {
            id: `prepared-${file.name}`,
            name: file.name,
            mimeType: file.type,
            size: file.size,
            data: new ArrayBuffer(file.size),
        };
    },
    async *sendMessage() {
        yield { type: "done" };
    },
};

function renderComposer(
    onSend = vi.fn(async () => true),
    onContentChange = vi.fn(),
    content = "",
) {
    mocks.markdown = "";
    mocks.html = "";
    mocks.setContent.mockClear();
    const props: ComposerProps = {
        theme: "light" as ComposerProps["theme"],
        disabled: false,
        isStreaming: false,
        adapter,
        content,
        onContentChange,
        allNotes: [],
        mentionItems: [],
        onCancel: vi.fn(),
        onSend,
    };
    render(<MarkdownChatComposer {...props} />);
    return { onSend, onContentChange };
}

function pasteEvent(files: File[], items: Array<{ kind: string; getAsFile(): File | null }> = []): ClipboardEvent {
    const event = new Event("paste");
    Object.defineProperty(event, "clipboardData", { value: { files, items } });
    return event as ClipboardEvent;
}

describe("MarkdownChatComposer drafts", () => {
    it("reports editor HTML changes so each conversation can keep its own draft", () => {
        const onContentChange = vi.fn();
        renderComposer(undefined, onContentChange);

        act(() => {
            mocks.onUpdate({
                editor: {
                    getHTML: () => "<p>Unsent text</p>",
                    getMarkdown: () => "Unsent text",
                },
            });
        });

        expect(onContentChange).toHaveBeenCalledWith("<p>Unsent text</p>");
    });
    it("enables sending after restoring a saved editor draft", async () => {
        const onSend = vi.fn(async () => true);
        renderComposer(onSend, vi.fn(), "<p>Return to this text</p>");

        const sendButton = screen.getByRole("button", { name: "Send message" });
        await waitFor(() => expect(sendButton).toBeEnabled());
        fireEvent.click(sendButton);

        await waitFor(() => expect(onSend).toHaveBeenCalledWith("Return to this text", []));
    });

});

describe("MarkdownChatComposer attachments", () => {
    it("only consumes paste when a supported file is routed to attachments", async () => {
        renderComposer();
        let normalPasteConsumed = true;
        let filePasteConsumed = false;

        act(() => {
            normalPasteConsumed = mocks.handlePaste(pasteEvent([]));
            filePasteConsumed = mocks.handlePaste(
                [pasteEvent([new File(["image"], "diagram.png", { type: "image/png" })])][0],
            );
        });

        expect(normalPasteConsumed).toBe(false);
        expect(filePasteConsumed).toBe(true);
        expect(await screen.findByText("diagram.png")).toBeInTheDocument();
    });

    it("consumes rejected files and supports items-only screenshot clipboards", async () => {
        renderComposer();
        const screenshot = new File(["image"], "screenshot.png", { type: "image/png" });
        let screenshotConsumed = false;
        let rejectedConsumed = false;

        act(() => {
            screenshotConsumed = mocks.handlePaste(pasteEvent([], [{ kind: "file", getAsFile: () => screenshot }]));
            rejectedConsumed = mocks.handlePaste(
                pasteEvent([new File(["svg"], "unsafe.svg", { type: "image/svg+xml" })]),
            );
        });

        expect(screenshotConsumed).toBe(true);
        expect(rejectedConsumed).toBe(true);
        expect(await screen.findByText("screenshot.png")).toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent("unsafe.svg");
    });

    it("routes dropped files into an attachment-only send and clears after success", async () => {
        const { onSend } = renderComposer();
        const form = screen.getByRole("form", { name: "AI message composer" });
        const file = new File(["report"], "report.pdf", { type: "application/pdf" });

        fireEvent.drop(form, { dataTransfer: { files: [file], types: ["Files"] } });
        await screen.findByText("report.pdf");
        fireEvent.click(screen.getByRole("button", { name: "Send message" }));

        await waitFor(() =>
            expect(onSend).toHaveBeenCalledWith(
                "",
                expect.arrayContaining([expect.objectContaining({ name: "report.pdf", mimeType: "application/pdf" })]),
            ),
        );
        await waitFor(() => expect(screen.queryByText("report.pdf")).not.toBeInTheDocument());
    });
});
