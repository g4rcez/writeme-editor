import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Note } from "@/store/note";
import { ContextPane } from "./context-pane";
const mocks = vi.hoisted(() => ({
    isElectron: vi.fn(() => false),
    statFile: vi.fn(),
}));

vi.mock("@/lib/is-electron", () => ({ isElectron: mocks.isElectron }));

const note = Note.parse({ id: "current", title: "Current note", content: "[[Target|the target]]" });
const target = Note.parse({ id: "target", title: "Target" });

vi.mock("@/lib/note-connection-actions", () => ({
    applyConnectionRepair: vi.fn(),
    createConnectionTarget: vi.fn(),
    refreshConnectionNotes: vi.fn(),
    undoConnectionRepair: vi.fn(),
}));

function setMatchMedia(narrow = false): void {
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: vi.fn((query: string) => ({
            matches: narrow && query === "(max-width: 959px)",
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
}

function renderContext(
    currentNote: Note = note,
    notes: Note[] = [currentNote, target],
    workspaceDirectory: string | null = null,
    narrowViewport = false,
): void {
    setMatchMedia(narrowViewport);
    render(
        <MemoryRouter>
            <ContextPane
                note={currentNote}
                notes={notes}
                workspaceDirectory={workspaceDirectory}
                open
                onClose={vi.fn()}
            />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    mocks.isElectron.mockReturnValue(false);
    mocks.statFile.mockReset();
    Object.defineProperty(window, "electronAPI", {
        configurable: true,
        value: { fs: { statFile: mocks.statFile } },
    });
});

afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, "matchMedia");
    Reflect.deleteProperty(window, "electronAPI");
});

describe("ContextPane", () => {
    it("keeps mentions collapsed and closes a preview before the desktop context landmark on Escape", () => {
        renderContext(note, [
            note,
            target,
            Note.parse({ id: "source", title: "Source", content: "Review Current note." }),
        ]);
        const panel = screen.getByRole("complementary", { name: "Context" });
        const trigger = screen.getByRole("button", { name: "Preview link", hidden: true });
        expect(trigger.closest("details")).not.toHaveAttribute("open");
        fireEvent.click(screen.getByText("Unlinked mentions"));
        fireEvent.click(trigger);
        expect(screen.getByRole("region", { name: "Link preview" })).toHaveFocus();
        fireEvent.keyDown(document.activeElement!, { key: "Escape" });
        expect(screen.queryByRole("region", { name: "Link preview" })).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
        expect(panel).toBeInTheDocument();
    });

    it("renders the current note inside a desktop complementary landmark", () => {
        renderContext();

        expect(screen.getByRole("complementary", { name: "Context" })).toContainElement(
            screen.getByText("Current note"),
        );
    });

    it("uses the design-system modal drawer at narrow widths", () => {
        renderContext(note, [note, target], null, true);

        expect(screen.getByRole("dialog", { name: "Context" })).toBeInTheDocument();
        expect(screen.getByText("Current note")).toBeInTheDocument();
    });

    it("links existing workspace files to notes and counts missing files as unresolved", async () => {
        const source = Note.parse({
            id: "playground",
            title: "md-playground",
            filePath: "/workspace/tests/md-playground.md",
            content: [
                '[README.md](projects/splinter/README.md "writeme-mention:file:projects/splinter/README.md")',
                '[maestro.md](ai/maestro.md "writeme-mention:file:ai/maestro.md")',
                '[missing.md](missing.md "writeme-mention:file:missing.md")',
                "",
                "#hashtag",
            ].join("\n\n"),
        });
        const readme = Note.parse({
            id: "readme",
            title: "README",
            filePath: "/workspace/projects/splinter/README.md",
        });
        const maestro = Note.parse({
            id: "maestro",
            title: "maestro",
            filePath: "/workspace/ai/maestro.md",
        });
        mocks.isElectron.mockReturnValue(true);
        mocks.statFile.mockImplementation(async (path: string) => ({
            success: true,
            exists: path !== "/workspace/missing.md",
        }));
        renderContext(source, [source, readme, maestro], "/workspace");

        fireEvent.click(screen.getByText("File references"));
        const readmeLink = await screen.findByRole("link", { name: /README\.md/ });
        const maestroLink = await screen.findByRole("link", { name: /maestro\.md/ });
        expect(readmeLink).toHaveAttribute("href", "/note/readme");
        expect(maestroLink).toHaveAttribute("href", "/note/maestro");
        expect(screen.queryByRole("link", { name: /missing\.md/ })).not.toBeInTheDocument();
        expect(mocks.statFile).toHaveBeenCalledWith("/workspace/projects/splinter/README.md");
        expect(mocks.statFile).toHaveBeenCalledWith("/workspace/ai/maestro.md");
        expect(mocks.statFile).toHaveBeenCalledWith("/workspace/missing.md");

        fireEvent.click(screen.getByText("Unresolved references"));
        const unresolvedSection = screen.getByText("Unresolved references").closest("details");
        expect(unresolvedSection).not.toBeNull();
        expect(within(unresolvedSection!).getByText("1")).toBeInTheDocument();
        expect(await within(unresolvedSection!).findByText("Missing from workspace")).toBeInTheDocument();

        fireEvent.click(screen.getByText("Tags"));
        expect(screen.getByText("#hashtag")).toBeInTheDocument();
    });
});
