import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "@/store/note";
import { CreateNoteDialog } from "./create-note-dialog";

type MockInputProps = InputHTMLAttributes<HTMLInputElement> & { title?: string };
type MockButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { theme?: string };
type MockModalProps = { open: boolean; title: string; children: ReactNode };
type MockAutocompleteProps = MockInputProps & {
    dynamicOption?: boolean;
    options: Array<{ value: string; label?: string }>;
    emptyMessage?: string;
    feedback?: string;
};

const mocks = vi.hoisted(() => ({
    state: {
        createNoteDialog: { isOpen: true, type: "note", templateId: "", initialTitle: "" },
        notes: [],
        directory: "/workspace",
    },
    dispatch: {
        setCreateNoteDialog: vi.fn(),
        note: vi.fn(),
    },
    templates: [] as Array<{ id: string; title: string; content: string }>,
    navigate: vi.fn(),
    saveNote: vi.fn(),
    getNote: vi.fn(),
    readDir: vi.fn(),
    statFile: vi.fn(),
    writeFile: vi.fn(),
}));

vi.mock("@/store/global.store", () => ({
    useGlobalStore: () => [mocks.state, mocks.dispatch],
    repositories: { notes: { save: mocks.saveNote, getOne: mocks.getNote } },
}));

vi.mock("@/app/hooks/use-templates", () => ({ useTemplates: () => ({ templates: mocks.templates }) }));
vi.mock("@/app/hooks/use-scripts", () => ({ useScripts: () => ({ scripts: [] }) }));
vi.mock("@/lib/is-electron", () => ({ isElectron: () => true }));
vi.mock("@/lib/window-mode", () => ({ isFloatingEditorWindow: () => false }));
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return { ...actual, useNavigate: () => mocks.navigate };
});
vi.mock("@g4rcez/components", () => ({
    Autocomplete: ({ title, dynamicOption, options, emptyMessage: _emptyMessage, feedback: _feedback, ...props }: MockAutocompleteProps) => (
        <label>
            <span>{title}</span>
            <input aria-label={title} data-dynamic={dynamicOption} {...props} />
            {options.map((option) => <span key={option.value}>{option.label ?? option.value}</span>)}
        </label>
    ),
    Button: ({ type, disabled, onClick, children }: MockButtonProps) => (
        <button type={type} disabled={disabled} onClick={onClick}>
            {children}
        </button>
    ),
    Input: ({ title, ...props }: MockInputProps) => (
        <label>
            <span>{title}</span>
            <input aria-label={title} {...props} />
        </label>
    ),
    Modal: ({ open, title, children }: MockModalProps) =>
        open ? (
            <div role="dialog" aria-label={title}>
                {children}
            </div>
        ) : null,
}));

describe("CreateNoteDialog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(mocks.state.createNoteDialog, {
            isOpen: true,
            type: "note",
            templateId: "",
            initialTitle: "",
        });
        mocks.state.notes.length = 0;
        mocks.templates.length = 0;
        mocks.saveNote.mockResolvedValue(undefined);
        mocks.getNote.mockResolvedValue(null);
        mocks.state.directory = "/workspace";
        mocks.readDir.mockResolvedValue({ entries: [] });
        mocks.statFile.mockResolvedValue({ success: true, exists: false });
        mocks.writeFile.mockResolvedValue({ success: true, fileSize: 13, lastModified: Date.now() });
        Object.defineProperty(window, "electronAPI", {
            configurable: true,
            value: {
                fs: {
                    readDir: mocks.readDir,
                    statFile: mocks.statFile,
                    writeFile: mocks.writeFile,
                },
            },
        });
    });

    it.each(["Projects/Meeting notes", "/Projects/Meeting notes", "/Meeting notes"])(
        "resolves %s inside the workspace", async (title) => {
        render(<CreateNoteDialog />);

        expect(screen.getByLabelText("Note title")).toHaveAttribute("data-dynamic", "true");
        expect(screen.queryByText("Folder (optional)")).not.toBeInTheDocument();
        fireEvent.input(screen.getByLabelText("Note title"), { target: { value: title } });
        fireEvent.click(screen.getByRole("button", { name: /Create/ }));

        await waitFor(() => expect(mocks.saveNote).toHaveBeenCalledTimes(1));

        expect(mocks.readDir).toHaveBeenCalledWith("/workspace");
        const filePath = title === "/Meeting notes" ? "/workspace/meeting-notes.md" : "/workspace/Projects/meeting-notes.md";
        expect(mocks.writeFile).toHaveBeenCalledWith(filePath, "");
        const savedNote = mocks.saveNote.mock.calls[0]?.[0] as Note | undefined;
        expect(savedNote?.filePath).toBe(filePath);
        expect(savedNote?.fileSize).toBe(13);
    });

    it("uses the folder path basename as a task note title", async () => {
        mocks.state.createNoteDialog.type = "task";
        render(<CreateNoteDialog />);
        fireEvent.input(screen.getByLabelText("Note title"), { target: { value: "tasks/testing name" } });
        fireEvent.click(screen.getByRole("button", { name: /Create/ }));
        await waitFor(() => expect(mocks.saveNote).toHaveBeenCalledTimes(1));
        expect(mocks.saveNote.mock.calls[0]?.[0].title).toBe("testing name");
    });

    it("uses a plain title input when folder suggestions are unavailable", async () => {
        mocks.state.directory = "";
        render(<CreateNoteDialog />);
        const title = screen.getByLabelText("Note title");
        expect(title).not.toHaveAttribute("data-dynamic");
        fireEvent.change(title, { target: { value: "Browser note" } });
        fireEvent.click(screen.getByRole("button", { name: "Create note" }));
        await waitFor(() => expect(mocks.saveNote).toHaveBeenCalledTimes(1));
        expect(mocks.saveNote.mock.calls[0]?.[0].title).toBe("Browser note");
        expect(mocks.readDir).not.toHaveBeenCalled();
    });

    it("uses clear template labels and names the create action", () => {
        mocks.templates.push({ id: "template-1", title: "Meeting", content: "Agenda" });
        render(<CreateNoteDialog />);

        expect(screen.getByLabelText("Template (optional)")).toHaveAttribute("placeholder", "Choose a template");
        expect(screen.getByText("No starter example")).toBeInTheDocument();
        expect(screen.getByText("No saved template")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Create note" })).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("Template (optional)"), { target: { value: "template-1" } });
        expect(screen.getByRole("button", { name: "Create note" })).toBeInTheDocument();
    });

    it("previews a starter without changing the title and resets on reopening", () => {
        const { rerender } = render(<CreateNoteDialog />);
        fireEvent.input(screen.getByLabelText("Note title"), { target: { value: "My project" } });
        fireEvent.change(screen.getByLabelText("Starter example (optional)"), { target: { value: "project-brief" } });
        expect(screen.getByText("Define the goal, scope, and next steps for a project.")).toBeInTheDocument();
        expect(screen.getByLabelText("Starter content preview")).toHaveTextContent("## Goal");
        expect(screen.getByLabelText("Note title")).toHaveValue("My project");
        mocks.state.createNoteDialog.isOpen = false;
        rerender(<CreateNoteDialog />);
        mocks.state.createNoteDialog.isOpen = true;
        rerender(<CreateNoteDialog />);
        expect(screen.getByLabelText("Starter example (optional)")).toHaveValue("");
        expect(screen.queryByText("Preview content")).not.toBeInTheDocument();
    });

    it.each(["quick", "task", "excalidraw", "freehand", "meeting-note", "pdf"])(
        "keeps starters out of %s creation", (type) => {
            mocks.state.createNoteDialog.type = type;
            render(<CreateNoteDialog />);
            expect(screen.queryByLabelText("Starter example (optional)")).not.toBeInTheDocument();
        },
    );

    it.each([
        ["read", "Couldn’t open the workspace folder."],
        ["stat", "Couldn’t check for an existing note."],
        ["write", "Couldn’t save the note in this folder."],
    ])("shows actionable copy and separate technical details for a %s failure", async (operation, message) => {
        if (operation === "read") mocks.readDir.mockResolvedValue({ error: "Access denied" });
        if (operation === "stat") mocks.statFile.mockResolvedValue({ success: false, error: "Access denied" });
        if (operation === "write") mocks.writeFile.mockResolvedValue({ success: false, error: "Access denied" });
        render(<CreateNoteDialog />);
        fireEvent.input(screen.getByLabelText("Note title"), { target: { value: "Projects/Draft" } });
        fireEvent.click(screen.getByRole("button", { name: "Create note" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(message);
        expect(screen.getByRole("alert")).not.toHaveTextContent("Access denied");
        const details = screen.getByText("Technical details").closest("details");
        expect(details).not.toHaveAttribute("open");
        expect(details).toHaveTextContent("Access denied");
        expect(screen.getByLabelText("Note title")).toHaveValue("Projects/Draft");
        expect(mocks.saveNote).not.toHaveBeenCalled();

        fireEvent.input(screen.getByLabelText("Note title"), { target: { value: "Projects/" } });
        fireEvent.click(screen.getByRole("button", { name: "Create note" }));
        expect(screen.getByRole("alert")).toHaveTextContent("Enter a note name after the folder path.");
        expect(screen.queryByText("Technical details")).not.toBeInTheDocument();
    });

    it("preloads two folder levels, excludes .git, and does not reload while typing", async () => {
        mocks.readDir.mockImplementation(async (path: string) => ({ entries: path === "/workspace" ? [
            { name: "Projects", path: "/workspace/Projects", type: "directory" },
            { name: ".git", path: "/workspace/.git", type: "directory" },
            { name: "file.md", path: "/workspace/file.md", type: "file" },
        ] : [
            { name: "Work", path: "/workspace/Projects/Work", type: "directory" },
            { name: ".git", path: "/workspace/Projects/.git", type: "directory" },
        ] }));
        render(<CreateNoteDialog />);
        expect(await screen.findByText("/Projects/")).toBeInTheDocument();
        expect(await screen.findByText("/Projects/Work/")).toBeInTheDocument();
        expect(screen.queryByText("/.git/")).not.toBeInTheDocument();
        expect(screen.queryByText("/Projects/.git/")).not.toBeInTheDocument();
        expect(screen.queryByText("/file.md/")).not.toBeInTheDocument();
        expect(mocks.readDir.mock.calls).toEqual([["/workspace"], ["/workspace/Projects"]]);
        fireEvent.input(screen.getByLabelText("Note title"), { target: { value: "/Projects/Meeting notes" } });
        expect(screen.getByText("/Projects/Work/")).toBeInTheDocument();
        expect(mocks.readDir).toHaveBeenCalledTimes(2);
    });

    it("ignores folder results from a previous workspace", async () => {
        let resolveRead: (value: { entries: Array<{ name: string; path: string; type: string }> }) => void = () => {};
        mocks.readDir.mockReturnValueOnce(new Promise((resolve) => { resolveRead = resolve; }));
        const { rerender } = render(<CreateNoteDialog />);
        mocks.state.directory = "/other";
        rerender(<CreateNoteDialog />);
        await act(async () => resolveRead({ entries: [{ name: "Old", path: "/workspace/Old", type: "directory" }] }));
        expect(screen.queryByText("/Old/")).not.toBeInTheDocument();
        expect(mocks.readDir).not.toHaveBeenCalledWith("/workspace/Old");
    });

    it("rejects a folder prefix without a note name", () => {
        render(<CreateNoteDialog />);
        fireEvent.input(screen.getByLabelText("Note title"), { target: { value: "Projects/" } });
        fireEvent.click(screen.getByRole("button", { name: /Create/ }));
        expect(screen.getByRole("alert")).toHaveTextContent("Enter a note name after the folder path.");
        expect(mocks.saveNote).not.toHaveBeenCalled();
    });

    it.each(["../Outside", "/../Outside", "//Outside", "C:\\Outside"])("rejects paths outside the workspace: %s", (value) => {
        render(<CreateNoteDialog />);
        fireEvent.input(screen.getByLabelText("Note title"), { target: { value } });
        fireEvent.click(screen.getByRole("button", { name: /Create/ }));
        expect(screen.getByRole("alert")).toHaveTextContent("Use a relative folder path inside the workspace.");
        expect(mocks.saveNote).not.toHaveBeenCalled();
        expect(mocks.writeFile).not.toHaveBeenCalled();
    });

    it("keeps the draft and folder when workspace notes refresh while the dialog is open", async () => {
        const { rerender } = render(<CreateNoteDialog />);
        fireEvent.input(screen.getByLabelText("Note title"), { target: { value: "Projects/Advisor" } });
        mocks.state.notes = [];
        rerender(<CreateNoteDialog />);
        expect(screen.getByLabelText("Note title")).toHaveValue("Projects/Advisor");
        fireEvent.click(screen.getByRole("button", { name: /Create/ }));
        await waitFor(() => expect(mocks.saveNote).toHaveBeenCalledTimes(1));
        expect(mocks.writeFile).toHaveBeenCalledWith("/workspace/Projects/advisor.md", "");
    });
});
