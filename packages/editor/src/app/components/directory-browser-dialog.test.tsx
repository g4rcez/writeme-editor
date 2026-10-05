import type { InputHTMLAttributes, ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { forwardRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FileSearchEvent } from "@/types/tree";
import { useGlobalStore } from "@/store/global.store";
import { repositories } from "@/store/repositories";
import { DirectoryBrowserDialog } from "./directory-browser-dialog";

type MockInputProps = InputHTMLAttributes<HTMLInputElement> & {
    left?: ReactNode;
    right?: ReactNode;
    hiddenLabel?: boolean;
    title?: string;
};

type MockModalProps = {
    children: ReactNode;
    title: string;
    open: boolean;
};

vi.mock("@/store/global.store", () => ({
    useGlobalStore: vi.fn(),
}));

vi.mock("@/store/repositories", () => ({
    repositories: {
        notes: {
            getAll: vi.fn(),
            getOne: vi.fn(),
            save: vi.fn(),
        },
    },
}));

vi.mock("@g4rcez/components", () => ({
    css: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
    Empty: ({ message }: { message: string }) => <div>{message}</div>,
    Input: forwardRef<HTMLInputElement, MockInputProps>(function MockInput(
        { left, right, hiddenLabel, title, ...props },
        ref,
    ) {
        return (
            <label>
                {hiddenLabel ? null : <span>{title}</span>}
                {left}
                <input ref={ref} aria-label={hiddenLabel ? title : undefined} {...props} />
                {right}
            </label>
        );
    }),
    Modal: ({ children, title, open }: MockModalProps) =>
        open ? (
            <div data-testid="modal">
                <h1>{title}</h1>
                {children}
            </div>
        ) : null,
    Shortcut: ({ value }: { value: string }) => <kbd>{value}</kbd>,
}));

describe("DirectoryBrowserDialog", () => {
    const readDir = vi.fn();
    const readFile = vi.fn();
    const startFileSearch = vi.fn();
    const cancelFileSearch = vi.fn();
    let fileSearchEvent: ((event: FileSearchEvent) => void) | null = null;
    const dispatch = {
        directoryBrowserDialog: vi.fn(),
        note: vi.fn(),
    };
    const state = {
        directoryBrowserDialog: true,
        directory: "/workspace",
    };

    afterEach(() => {
        cleanup();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        fileSearchEvent = null;
        readDir.mockResolvedValue({ entries: [] });
        readFile.mockResolvedValue({
            success: true,
            content: "# Note",
            fileSize: 6,
            lastModified: new Date().toISOString(),
        });
        startFileSearch.mockResolvedValue({ success: true });
        cancelFileSearch.mockResolvedValue({ success: true });
        vi.mocked(repositories.notes.getAll).mockResolvedValue([]);
        vi.mocked(repositories.notes.save).mockImplementation(async (note) => note);
        dispatch.note.mockResolvedValue(undefined);
        vi.mocked(useGlobalStore).mockReturnValue([state, dispatch] as never);
        Object.defineProperty(window, "electronAPI", {
            configurable: true,
            value: {
                env: { getHome: vi.fn() },
                fs: {
                    readDir,
                    readFile,
                    startFileSearch,
                    cancelFileSearch,
                    onFileSearchEvent: vi.fn((callback: (event: FileSearchEvent) => void) => {
                        fileSearchEvent = callback;
                        return vi.fn();
                    }),
                },
            },
        });
    });

    it("lists the workspace directory with relative prefixes", async () => {
        readDir.mockResolvedValue({
            entries: [
                { name: "notes", path: "/workspace/notes", type: "directory" },
                { name: "README.md", path: "/workspace/README.md", type: "file", extension: ".md" },
            ],
        });

        render(<DirectoryBrowserDialog />);

        await waitFor(() => expect(readDir).toHaveBeenCalledWith("/workspace"));
        expect(screen.getByRole("heading", { name: "workspace" })).toBeInTheDocument();
        expect(screen.getByText("./")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /notes/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /README\.md/ })).toBeInTheDocument();
    });

    it("loads a directory when it is selected with Enter", async () => {
        readDir.mockImplementation(async (directory: string) => {
            if (directory === "/workspace") {
                return { entries: [{ name: "notes", path: "/workspace/notes", type: "directory" }] };
            }
            return {
                entries: [{ name: "draft.md", path: "/workspace/notes/draft.md", type: "file", extension: ".md" }],
            };
        });

        render(<DirectoryBrowserDialog />);
        await waitFor(() => expect(screen.getByRole("button", { name: /notes/ })).toBeInTheDocument());

        await act(async () => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
            await Promise.resolve();
        });

        await waitFor(() => expect(readDir).toHaveBeenCalledWith("/workspace/notes"));
        expect(screen.getByRole("heading", { name: "notes" })).toBeInTheDocument();
        expect(screen.getByText("./notes")).toBeInTheDocument();
        expect(screen.getByText("notes/draft.md")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Parent directory/ })).toBeInTheDocument();
    });

    it("keeps directory entries visible while recursive search loads", async () => {
        readDir.mockResolvedValue({
            entries: [{ name: "README.md", path: "/workspace/README.md", type: "file", extension: ".md" }],
        });

        render(<DirectoryBrowserDialog />);
        expect(await screen.findByText("README.md")).toBeInTheDocument();

        fireEvent.change(screen.getByRole("textbox", { name: "Search files and directories" }), {
            target: { value: "spli" },
        });

        await waitFor(() => expect(startFileSearch).toHaveBeenCalledWith("/workspace", "spli", expect.any(String)));
        expect(screen.getByText("README.md")).toBeInTheDocument();
        expect(screen.getByRole("status", { name: "Searching directory" })).toBeInTheDocument();
        const requestId = startFileSearch.mock.calls[0]?.[2];

        act(() => {
            fileSearchEvent?.({
                requestId,
                type: "batch",
                entries: [
                    {
                        name: "split-pane",
                        path: "/workspace/src/split-pane",
                        relativePath: "src/split-pane",
                        type: "directory",
                    },
                    {
                        name: "split-view.tsx",
                        path: "/workspace/src/split-pane/split-view.tsx",
                        relativePath: "src/split-pane/split-view.tsx",
                        type: "file",
                        extension: ".tsx",
                    },
                ],
            });
        });

        expect(await screen.findByText("split-pane")).toBeInTheDocument();
        expect(screen.getByText("split-view.tsx")).toBeInTheDocument();

        act(() => {
            fileSearchEvent?.({ requestId, type: "complete", truncated: false });
        });
        expect(screen.queryByRole("status", { name: "Searching directory" })).not.toBeInTheDocument();
    });

    it("opens a selected file with Enter", async () => {
        readDir.mockResolvedValue({
            entries: [{ name: "README.md", path: "/workspace/README.md", type: "file", extension: ".md" }],
        });

        render(<DirectoryBrowserDialog />);
        await waitFor(() => expect(screen.getByRole("button", { name: /README\.md/ })).toBeInTheDocument());

        await act(async () => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
            await Promise.resolve();
        });

        await waitFor(() => expect(readFile).toHaveBeenCalledWith("/workspace/README.md"));
        expect(dispatch.directoryBrowserDialog).toHaveBeenCalledWith(false);
    });

    it("opens LaTeX files with their exact source and path", async () => {
        const source = "\\documentclass{article}\n\\begin{document}\n$ x^2 $\n\\end{document}\n";
        readDir.mockResolvedValue({
            entries: [{ name: "paper.latex", path: "/workspace/paper.latex", type: "file", extension: ".latex" }],
        });
        readFile.mockResolvedValue({
            success: true,
            content: source,
            fileSize: source.length,
            lastModified: "2026-01-01T00:00:00.000Z",
        });

        render(<DirectoryBrowserDialog />);
        await waitFor(() => expect(screen.getByRole("button", { name: /paper\.latex/ })).toBeInTheDocument());

        await act(async () => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(dispatch.note).toHaveBeenCalledWith(
                expect.objectContaining({ content: source, filePath: "/workspace/paper.latex" }),
            );
        });
        expect(dispatch.directoryBrowserDialog).toHaveBeenCalledWith(false);
    });
});
