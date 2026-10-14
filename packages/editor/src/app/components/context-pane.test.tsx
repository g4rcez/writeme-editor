import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Note } from "@/store/note";
import { ContextPane } from "./context-pane";

const note = Note.parse({ id: "current", title: "Current note", content: "[[Target|the target]]" });
const target = Note.parse({ id: "target", title: "Target" });

vi.mock("@/lib/note-connection-actions", () => ({
    applyConnectionRepair: vi.fn(),
    createConnectionTarget: vi.fn(),
    refreshConnectionNotes: vi.fn(),
    undoConnectionRepair: vi.fn(),
}));

function setViewport(narrow: boolean): void {
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: vi.fn((query: string) => ({
            matches: narrow && query === "(max-width: 959px)",
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
}

function renderContext(notes: Note[] = [note, target]): void {
    render(
        <MemoryRouter>
            <ContextPane note={note} notes={notes} onClose={vi.fn()} />
        </MemoryRouter>,
    );
}

afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, "matchMedia");
});

describe("ContextPane responsive semantics", () => {
    it("keeps mentions collapsed, focuses a preview, and closes it before the panel on Escape", () => {
        setViewport(false);
        renderContext([note, target, Note.parse({ id: "source", title: "Source", content: "Review Current note." })]);
        const trigger = screen.getByRole("button", { name: "Preview link", hidden: true });
        expect(trigger.closest("details")).not.toHaveAttribute("open");
        fireEvent.click(screen.getByText("Unlinked mentions"));
        fireEvent.click(trigger);
        expect(screen.getByRole("region", { name: "Link preview" })).toHaveFocus();
        fireEvent.keyDown(document.activeElement!, { key: "Escape" });
        expect(screen.queryByRole("region", { name: "Link preview" })).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
        expect(screen.getByRole("complementary", { name: "Context" })).toBeInTheDocument();
    });
    it("renders as a non-modal desktop complementary panel", () => {
        setViewport(false);
        renderContext();

        expect(screen.getByRole("complementary", { name: "Context" })).toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("uses the design-system modal drawer at narrow widths", () => {
        setViewport(true);
        renderContext();

        expect(screen.getByRole("dialog", { name: "Context" })).toBeInTheDocument();
        expect(screen.getByText("Current note")).toBeInTheDocument();
    });
});
