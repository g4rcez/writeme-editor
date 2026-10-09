import type { InputHTMLAttributes, ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { forwardRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FileSearchEvent } from "@/types/tree";
import { WorkspaceFolderAutocomplete } from "./workspace-folder-autocomplete";

type MockInputProps = InputHTMLAttributes<HTMLInputElement> & {
    title: string;
    right?: ReactNode;
};

vi.mock("@g4rcez/components", () => ({
    Input: forwardRef<HTMLInputElement, MockInputProps>(function MockInput({ title, right, ...props }, ref) {
        return (
            <label>
                <span>{title}</span>
                <input ref={ref} {...props} />
                {right}
            </label>
        );
    }),
}));

vi.mock("@phosphor-icons/react/dist/csr/FolderSimple", () => ({
    FolderSimpleIcon: () => <span aria-hidden="true">Folder</span>,
}));

describe("WorkspaceFolderAutocomplete", () => {
    const startFileSearch = vi.fn();
    const cancelFileSearch = vi.fn();
    let fileSearchListener: ((event: FileSearchEvent) => void) | null = null;
    const onSelectionChange = vi.fn();

    afterEach(() => cleanup());

    beforeEach(() => {
        vi.clearAllMocks();
        fileSearchListener = null;
        startFileSearch.mockResolvedValue({ success: true });
        cancelFileSearch.mockResolvedValue({ success: true });
        Object.defineProperty(window, "electronAPI", {
            configurable: true,
            value: {
                fs: {
                    startFileSearch,
                    cancelFileSearch,
                    onFileSearchEvent: vi.fn((callback: (event: FileSearchEvent) => void) => {
                        fileSearchListener = callback;
                        return vi.fn();
                    }),
                },
            },
        });
    });

    it("offers matching folders, filters out files, and supports keyboard selection", async () => {
        render(<WorkspaceFolderAutocomplete workspaceDirectory="/workspace" onSelectionChange={onSelectionChange} />);
        const input = screen.getByRole("combobox", { name: "Folder (optional)" });
        fireEvent.change(input, { target: { value: "proj" } });

        await waitFor(() => expect(startFileSearch).toHaveBeenCalledWith("/workspace", "proj", expect.any(String)));
        const requestId = startFileSearch.mock.calls[0]?.[2];
        expect(requestId).toEqual(expect.any(String));

        act(() => {
            fileSearchListener?.({
                requestId,
                type: "batch",
                entries: [
                    { name: "Projects", path: "/workspace/Projects", relativePath: "Projects", type: "directory" },
                    {
                        name: "Project plan.md",
                        path: "/workspace/Project plan.md",
                        relativePath: "Project plan.md",
                        type: "file",
                    },
                    {
                        name: "Research",
                        path: "/workspace/Notes/Research",
                        relativePath: "Notes/Research",
                        type: "directory",
                    },
                ],
            });
            fileSearchListener?.({ requestId, type: "complete", truncated: false });
        });

        const options = await screen.findAllByRole("option");
        expect(options.map((option) => option.textContent)).toEqual(["Folder./Notes/Research", "Folder./Projects"]);
        expect(onSelectionChange).toHaveBeenCalledWith(null, true);

        fireEvent.keyDown(input, { key: "ArrowDown" });
        fireEvent.keyDown(input, { key: "Enter" });

        expect(onSelectionChange).toHaveBeenLastCalledWith("/workspace/Projects", false);
        expect(input).toHaveValue("Projects");
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("lets the user clear a search when there are no matching folders", async () => {
        render(<WorkspaceFolderAutocomplete workspaceDirectory="/workspace" onSelectionChange={onSelectionChange} />);
        const input = screen.getByRole("combobox", { name: "Folder (optional)" });
        fireEvent.change(input, { target: { value: "missing" } });

        await waitFor(() => expect(startFileSearch).toHaveBeenCalled());
        const requestId = startFileSearch.mock.calls[0]?.[2];
        act(() => fileSearchListener?.({ requestId, type: "complete", truncated: false }));

        expect(await screen.findByRole("status")).toHaveTextContent("No matching folders");
        fireEvent.click(screen.getByRole("button", { name: "Clear folder search" }));

        expect(input).toHaveValue("");
        expect(onSelectionChange).toHaveBeenLastCalledWith(null, false);
    });

    it("reports a folder search error accessibly", async () => {
        render(<WorkspaceFolderAutocomplete workspaceDirectory="/workspace" onSelectionChange={onSelectionChange} />);
        fireEvent.change(screen.getByRole("combobox", { name: "Folder (optional)" }), {
            target: { value: "private" },
        });

        await waitFor(() => expect(startFileSearch).toHaveBeenCalled());
        const requestId = startFileSearch.mock.calls[0]?.[2];
        act(() => fileSearchListener?.({ requestId, type: "error", error: "Permission denied" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Could not search folders: Permission denied");
    });
});
