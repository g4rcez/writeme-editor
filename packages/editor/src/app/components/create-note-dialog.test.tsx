import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "@/store/note";
import { CreateNoteDialog } from "./create-note-dialog";

type MockInputProps = InputHTMLAttributes<HTMLInputElement> & { title?: string };
type MockButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { theme?: string };
type MockModalProps = { open: boolean; title: string; children: ReactNode };
type MockFolderAutocompleteProps = {
    onSelectionChange: (folderPath: string | null, isPending: boolean) => void;
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

vi.mock("@/app/hooks/use-templates", () => ({ useTemplates: () => ({ templates: [] }) }));
vi.mock("@/app/hooks/use-scripts", () => ({ useScripts: () => ({ scripts: [] }) }));
vi.mock("@/lib/is-electron", () => ({ isElectron: () => true }));
vi.mock("@/lib/window-mode", () => ({ isFloatingEditorWindow: () => false }));
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return { ...actual, useNavigate: () => mocks.navigate };
});
vi.mock("./workspace-folder-autocomplete", () => ({
    WorkspaceFolderAutocomplete: ({ onSelectionChange }: MockFolderAutocompleteProps) => (
        <button type="button" onClick={() => onSelectionChange("/workspace/Projects", false)}>
            Select Projects folder
        </button>
    ),
}));
vi.mock("@g4rcez/components", () => ({
    Autocomplete: () => null,
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
        mocks.state.directory = "/workspace";
        mocks.readDir.mockResolvedValue({ error: null });
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

    it("suggests workspace folders and writes a standard note to the selected folder", async () => {
        render(<CreateNoteDialog />);

        expect(screen.getByRole("button", { name: "Select Projects folder" })).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("Note title"), { target: { value: "Meeting notes" } });
        fireEvent.click(screen.getByRole("button", { name: "Select Projects folder" }));
        fireEvent.click(screen.getByRole("button", { name: /Create/ }));

        await waitFor(() => expect(mocks.saveNote).toHaveBeenCalledTimes(1));

        expect(mocks.readDir).toHaveBeenCalledWith("/workspace/Projects");
        expect(mocks.writeFile).toHaveBeenCalledWith("/workspace/Projects/meeting-notes.md", "");
        const savedNote = mocks.saveNote.mock.calls[0]?.[0] as Note | undefined;
        expect(savedNote?.filePath).toBe("/workspace/Projects/meeting-notes.md");
        expect(savedNote?.fileSize).toBe(13);
    });
});
