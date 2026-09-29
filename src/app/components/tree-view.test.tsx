import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FileSearchEvent, TreeNode } from "@/types/tree";
import { TreeView } from "./tree-view";

vi.mock("@/lib/is-electron", () => ({
    isElectron: () => true,
}));

type ContextMenuAction = {
    action: string;
    filePath: string;
    isDirectory: boolean;
};

function createDataTransfer() {
    const data = new Map<string, string>();
    return {
        dropEffect: "move",
        effectAllowed: "move",
        getData: vi.fn((type: string) => data.get(type) ?? ""),
        setData: vi.fn((type: string, value: string) => data.set(type, value)),
    };
}

describe("TreeView", () => {
    let contextMenuAction: ((action: ContextMenuAction) => void) | null = null;
    let directoryEntries: Record<string, TreeNode[]>;
    let readDir: ReturnType<typeof vi.fn>;
    let requestDirectoryAccess: ReturnType<typeof vi.fn>;
    let statFile: ReturnType<typeof vi.fn>;
    let moveFile: ReturnType<typeof vi.fn>;
    let fileSearchEvent: ((event: FileSearchEvent) => void) | null;
    let startFileSearch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        contextMenuAction = null;
        fileSearchEvent = null;
        startFileSearch = vi.fn(async () => ({ success: true as const }));
        directoryEntries = {
            "/workspace": [
                {
                    name: "existing.md",
                    path: "/workspace/existing.md",
                    type: "file",
                    extension: ".md",
                },
            ],
        };
        readDir = vi.fn(async (path: string) => ({
            entries: directoryEntries[path] ?? [],
        }));
        requestDirectoryAccess = vi.fn(async () => ({ granted: true }));
        statFile = vi.fn(async (path: string) => ({
            success: true,
            exists: Object.values(directoryEntries).some((entries) => entries.some((entry) => entry.path === path)),
        }));
        moveFile = vi.fn(async (oldPath: string, newPath: string) => {
            const oldParent = oldPath.substring(0, oldPath.lastIndexOf("/"));
            const newParent = newPath.substring(0, newPath.lastIndexOf("/"));
            const moved = directoryEntries[oldParent]?.find((entry) => entry.path === oldPath);
            if (!moved) return { success: false, error: "missing source" };
            directoryEntries[oldParent] = directoryEntries[oldParent]!.filter((entry) => entry.path !== oldPath);
            directoryEntries[newParent] = [
                ...(directoryEntries[newParent] ?? []),
                {
                    ...moved,
                    name: newPath.substring(newPath.lastIndexOf("/") + 1),
                    path: newPath,
                },
            ];
            return { success: true, newPath };
        });

        Object.assign(window, {
            electronAPI: {
                fs: {
                    readDir,
                    requestDirectoryAccess,
                    statFile,
                    moveFile,
                    startFileSearch,
                    cancelFileSearch: vi.fn(async () => ({ success: true as const })),
                    onFileSearchEvent: vi.fn((callback: (event: FileSearchEvent) => void) => {
                        fileSearchEvent = callback;
                        return vi.fn();
                    }),
                    onDirChanged: vi.fn(() => vi.fn()),
                },
                contextMenu: {
                    showExplorer: vi.fn(),
                },
                onContextMenuAction: vi.fn((callback) => {
                    contextMenuAction = callback;
                    return vi.fn();
                }),
            },
        });
    });

    it("requests directory access and retries after macOS denies access", async () => {
        readDir
            .mockResolvedValueOnce({
                entries: [],
                error: "EPERM: operation not permitted, scandir '/workspace'",
                errorCode: "EPERM",
            })
            .mockResolvedValueOnce({ entries: directoryEntries["/workspace"] });

        render(<TreeView rootPath="/workspace" map={new Map()} onFileSelect={vi.fn()} />);

        await waitFor(() => {
            expect(requestDirectoryAccess).toHaveBeenCalledWith("/workspace");
            expect(readDir).toHaveBeenCalledTimes(2);
            expect(screen.getByText("existing.md")).toBeInTheDocument();
        });
    });

    it("keeps the permission retry available until access is granted", async () => {
        readDir
            .mockResolvedValueOnce({ entries: [], error: "EPERM: operation not permitted", errorCode: "EPERM" })
            .mockResolvedValueOnce({ entries: directoryEntries["/workspace"] });
        requestDirectoryAccess
            .mockResolvedValueOnce({ granted: false, error: "Enable Documents Folder access, then retry." })
            .mockResolvedValueOnce({ granted: true });

        render(<TreeView rootPath="/workspace" map={new Map()} onFileSelect={vi.fn()} />);

        const retryButton = await screen.findByRole("button", { name: "Grant access and retry" });
        expect(await screen.findByText("Enable Documents Folder access, then retry.")).toBeInTheDocument();

        fireEvent.click(retryButton);

        expect(await screen.findByText("existing.md")).toBeInTheDocument();
        expect(requestDirectoryAccess).toHaveBeenCalledTimes(2);
    });

    it("discovers and activates TeX workspace files", async () => {
        directoryEntries["/workspace"] = [
            {
                name: "paper.tex",
                path: "/workspace/paper.tex",
                type: "file",
                extension: ".tex",
            },
            {
                name: "appendix.latex",
                path: "/workspace/appendix.latex",
                type: "file",
                extension: ".latex",
            },
        ];
        const onFileSelect = vi.fn();

        render(<TreeView rootPath="/workspace" map={new Map()} onFileSelect={onFileSelect} />);

        const texFile = await screen.findByText("paper.tex");
        const latexFile = await screen.findByText("appendix.latex");
        fireEvent.click(texFile);
        fireEvent.click(latexFile);

        expect(onFileSelect).toHaveBeenNthCalledWith(1, expect.objectContaining({ path: "/workspace/paper.tex" }));
        expect(onFileSelect).toHaveBeenNthCalledWith(2, expect.objectContaining({ path: "/workspace/appendix.latex" }));
    });

    it("streams recursive search results for the typed query", async () => {
        render(<TreeView rootPath="/workspace" searchQuery="guide" map={new Map()} onFileSelect={vi.fn()} />);

        await waitFor(() => expect(startFileSearch).toHaveBeenCalledWith("/workspace", "guide", expect.any(String)));
        const requestId = startFileSearch.mock.calls[0]?.[2] as string;

        act(() => {
            fileSearchEvent?.({
                requestId,
                type: "batch",
                entries: [
                    {
                        name: "guide.md",
                        path: "/workspace/docs/guide.md",
                        relativePath: "docs/guide.md",
                        type: "file",
                        extension: ".md",
                    },
                ],
            });
        });

        expect(await screen.findByText("docs/guide.md")).toBeInTheDocument();

        act(() => {
            fileSearchEvent?.({ requestId, type: "complete", truncated: false });
        });
    });

    it("creates a root file on Enter and refreshes the tree", async () => {
        const onNewFile = vi.fn(async (targetPath: string) => {
            directoryEntries["/workspace"] = [
                ...directoryEntries["/workspace"]!,
                {
                    name: "draft.md",
                    path: targetPath,
                    type: "file",
                    extension: ".md",
                },
            ];
            return true;
        });

        render(<TreeView rootPath="/workspace" map={new Map()} onFileSelect={vi.fn()} onNewFile={onNewFile} />);

        expect(await screen.findByText("existing.md")).toBeInTheDocument();

        act(() => {
            contextMenuAction?.({
                action: "new-file",
                filePath: "/workspace",
                isDirectory: true,
            });
        });

        const input = await screen.findByRole("textbox");
        fireEvent.change(input, { target: { value: "draft" } });
        fireEvent.keyDown(input, { key: "Enter" });

        await waitFor(() => {
            expect(onNewFile).toHaveBeenCalledTimes(1);
            expect(onNewFile).toHaveBeenCalledWith("/workspace/draft.md");
            expect(readDir).toHaveBeenCalledTimes(2);
            expect(screen.getByText("draft.md")).toBeInTheDocument();
        });
    });

    it("moves a dragged file into the dropped folder", async () => {
        directoryEntries["/workspace"] = [
            {
                name: "existing.md",
                path: "/workspace/existing.md",
                type: "file",
                extension: ".md",
            },
            {
                name: "docs",
                path: "/workspace/docs",
                type: "directory",
            },
        ];
        directoryEntries["/workspace/docs"] = [];
        const onMove = vi.fn(async (source, _targetDirectory, destinationPath) => {
            await (moveFile as unknown as (oldPath: string, newPath: string) => Promise<unknown>)(
                source.path,
                destinationPath,
            );
            return true;
        });

        render(<TreeView rootPath="/workspace" map={new Map()} onFileSelect={vi.fn()} onMove={onMove} />);

        const file = await screen.findByText("existing.md");
        const folder = await screen.findByText("docs");
        const dataTransfer = createDataTransfer();

        fireEvent.dragStart(file.closest('[role="treeitem"]')!, { dataTransfer });
        fireEvent.dragOver(folder.closest('[role="treeitem"]')!, { dataTransfer });
        fireEvent.drop(folder.closest('[role="treeitem"]')!, { dataTransfer });

        await waitFor(() => {
            expect(onMove).toHaveBeenCalledWith(
                expect.objectContaining({ path: "/workspace/existing.md" }),
                "/workspace/docs",
                "/workspace/docs/existing.md",
            );
            expect(moveFile).toHaveBeenCalledWith("/workspace/existing.md", "/workspace/docs/existing.md");
        });
    });

    it("handles root create requests for files and folders, including an empty tree", async () => {
        directoryEntries["/workspace"] = [];
        const onNewFile = vi.fn(async (targetPath: string) => {
            directoryEntries["/workspace"] = [
                {
                    name: "draft.md",
                    path: targetPath,
                    type: "file",
                    extension: ".md",
                },
            ];
            return true;
        });
        const onNewFolder = vi.fn(async (targetPath: string) => {
            directoryEntries["/workspace"] = [
                ...directoryEntries["/workspace"]!,
                {
                    name: "docs",
                    path: targetPath,
                    type: "directory",
                },
            ];
            return true;
        });

        const { rerender } = render(
            <TreeView
                rootPath="/workspace"
                map={new Map()}
                onFileSelect={vi.fn()}
                onNewFile={onNewFile}
                onNewFolder={onNewFolder}
            />,
        );

        expect(await screen.findByText("No files found in this directory")).toBeInTheDocument();

        rerender(
            <TreeView
                rootPath="/workspace"
                map={new Map()}
                createRequest={{ id: 1, kind: "file" }}
                onFileSelect={vi.fn()}
                onNewFile={onNewFile}
                onNewFolder={onNewFolder}
            />,
        );

        const fileInput = await screen.findByRole("textbox");
        fireEvent.change(fileInput, { target: { value: "draft" } });
        fireEvent.keyDown(fileInput, { key: "Enter" });

        await waitFor(() => {
            expect(onNewFile).toHaveBeenCalledWith("/workspace/draft.md");
            expect(screen.getByText("draft.md")).toBeInTheDocument();
        });

        rerender(
            <TreeView
                rootPath="/workspace"
                map={new Map()}
                createRequest={{ id: 2, kind: "directory" }}
                onFileSelect={vi.fn()}
                onNewFile={onNewFile}
                onNewFolder={onNewFolder}
            />,
        );

        const folderInput = await screen.findByRole("textbox");
        fireEvent.change(folderInput, { target: { value: "docs" } });
        fireEvent.keyDown(folderInput, { key: "Enter" });

        await waitFor(() => {
            expect(onNewFolder).toHaveBeenCalledWith("/workspace/docs");
            expect(screen.getByText("docs")).toBeInTheDocument();
        });
    });

    it("indents a pending file input under the parent folder", async () => {
        directoryEntries["/workspace"] = [
            {
                name: "docs",
                path: "/workspace/docs",
                type: "directory",
            },
        ];
        directoryEntries["/workspace/docs"] = [];

        render(<TreeView rootPath="/workspace" map={new Map()} onFileSelect={vi.fn()} onNewFile={vi.fn()} />);

        expect(await screen.findByText("docs")).toBeInTheDocument();

        act(() => {
            contextMenuAction?.({
                action: "new-file",
                filePath: "/workspace/docs",
                isDirectory: true,
            });
        });

        const input = await screen.findByRole("textbox");
        const pendingRow = input.parentElement;

        expect(pendingRow).toHaveStyle({ paddingLeft: "28px" });
        expect(pendingRow?.firstElementChild).toHaveClass("w-4");
    });
});
