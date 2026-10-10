import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FileSearchEvent } from "@/types/tree";
import { WorkspaceFolderAutocomplete } from "./workspace-folder-autocomplete";

type MockAutocompleteProps = {
    title: string;
    value?: string;
    placeholder?: string;
    options: { value: string; label?: string }[];
    loading?: boolean;
    error?: string;
    emptyMessage?: ReactNode;
    feedback?: ReactNode;
    right?: ReactNode;
    onChange?: (event: { target: { value: string } }) => void;
};

vi.mock("@g4rcez/components", async () => {
    const React = await vi.importActual<typeof import("react")>("react");

    return {
        Autocomplete: React.forwardRef<HTMLInputElement, MockAutocompleteProps>(function MockAutocomplete(
            { title, value, placeholder, options, loading, error, emptyMessage, feedback, right, onChange },
            ref,
        ) {
            const inputRef = React.useRef<HTMLInputElement>(null);
            const previousValue = React.useRef(value ?? "");
            const [isOpen, setIsOpen] = React.useState(false);

            React.useEffect(() => {
                if (value && value !== previousValue.current && inputRef.current) {
                    inputRef.current.value = options.find((option) => option.value === value)?.label ?? value;
                } else if (!value && previousValue.current && inputRef.current) {
                    inputRef.current.value = "";
                }
                previousValue.current = value ?? "";
            }, [options, value]);

            return (
                <div>
                    <label>
                        <span>{title}</span>
                        <input
                            ref={inputRef}
                            role="combobox"
                            aria-label={title}
                            placeholder={placeholder}
                            onFocus={() => setIsOpen(true)}
                            onInput={() => setIsOpen(true)}
                        />
                    </label>
                    <input ref={ref} type="hidden" value={value ?? ""} readOnly />
                    {right}
                    {feedback ? <p>{feedback}</p> : null}
                    {loading ? <p role="status">Searching folders...</p> : null}
                    {error ? <p role="alert">{error}</p> : null}
                    {!loading && options.length === 0 && emptyMessage ? <p role="status">{emptyMessage}</p> : null}
                    {isOpen && options.length > 0 ? (
                        <ul role="listbox">
                            {options.map((option) => (
                                <li key={option.value}>
                                    <button
                                        type="button"
                                        role="option"
                                        onClick={() => {
                                            if (inputRef.current) inputRef.current.value = option.label ?? option.value;
                                            setIsOpen(false);
                                            onChange?.({ target: { value: option.value } });
                                        }}
                                    >
                                        {option.label ?? option.value}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            );
        }),
    };
});

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

    it("suggests matching folders and forwards a selected folder", async () => {
        render(<WorkspaceFolderAutocomplete workspaceDirectory="/workspace" onSelectionChange={onSelectionChange} />);
        const input = screen.getByRole("combobox", { name: "Folder (optional)" });
        fireEvent.input(input, { target: { value: "proj" } });

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
        expect(options.map((option) => option.textContent)).toEqual(["./Notes/Research", "./Projects"]);
        expect(onSelectionChange).toHaveBeenCalledWith(null, true);

        fireEvent.click(screen.getByRole("option", { name: "./Projects" }));

        expect(onSelectionChange).toHaveBeenLastCalledWith("/workspace/Projects", false);
        expect(input).toHaveValue("./Projects");
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("lets the user clear a search when there are no matching folders", async () => {
        render(<WorkspaceFolderAutocomplete workspaceDirectory="/workspace" onSelectionChange={onSelectionChange} />);
        const input = screen.getByRole("combobox", { name: "Folder (optional)" });
        fireEvent.input(input, { target: { value: "missing" } });

        await waitFor(() => expect(startFileSearch).toHaveBeenCalled());
        const requestId = startFileSearch.mock.calls[0]?.[2];
        act(() => fileSearchListener?.({ requestId, type: "complete", truncated: false }));

        expect(await screen.findByText("No matching folders. Clear the search to use the workspace root.")).toBeVisible();
        fireEvent.click(screen.getByRole("button", { name: "Clear folder search" }));

        expect(screen.getByRole("combobox", { name: "Folder (optional)" })).toHaveValue("");
        expect(onSelectionChange).toHaveBeenLastCalledWith(null, false);
    });

    it("reports a folder search error accessibly", async () => {
        render(<WorkspaceFolderAutocomplete workspaceDirectory="/workspace" onSelectionChange={onSelectionChange} />);
        fireEvent.input(screen.getByRole("combobox", { name: "Folder (optional)" }), {
            target: { value: "private" },
        });

        await waitFor(() => expect(startFileSearch).toHaveBeenCalled());
        const requestId = startFileSearch.mock.calls[0]?.[2];
        act(() => fileSearchListener?.({ requestId, type: "error", error: "Permission denied" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Could not search folders: Permission denied");
    });
});
