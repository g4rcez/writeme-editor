import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Note, NoteType } from "@/store/note";
import { FloatingNotePage } from "./floating-note.page";

const mocks = vi.hoisted(() => ({
    note: null as unknown,
    getQuicknoteByDate: vi.fn(),
    setNote: vi.fn(),
}));

vi.mock("@/store/global.store", () => ({
    repositories: { notes: { getQuicknoteByDate: mocks.getQuicknoteByDate } },
    useGlobalStore: () => [{ note: mocks.note }, { note: mocks.setNote }],
}));
vi.mock("@/store/settings", () => ({ SettingsService: { load: () => ({}) } }));
vi.mock("@/lib/is-electron", () => ({ isElectron: () => false }));
vi.mock("@/app/editor", async () => {
    const React = await import("react");
    return { Editor: () => React.createElement("div", { "data-testid": "quick-note-editor" }) };
});

afterEach(() => vi.restoreAllMocks());

describe("FloatingNotePage keyboard handling", () => {
    it("closes on Escape before the editor can consume the key", async () => {
        const note = Note.parse({ id: "quick-note", title: "Quick Note", content: "", noteType: NoteType.quick });
        mocks.note = note;
        mocks.getQuicknoteByDate.mockResolvedValue(note);
        const closeWindow = vi.spyOn(window, "close").mockImplementation(() => { });

        render(<FloatingNotePage kind="quick" />);
        const editor = await screen.findByTestId("quick-note-editor");
        const editorKeydown = vi.fn((event: KeyboardEvent) => event.stopPropagation());
        editor.addEventListener("keydown", editorKeydown);

        fireEvent.keyDown(editor, { key: "Escape", bubbles: true, cancelable: true });
        expect(closeWindow).toHaveBeenCalledOnce();
        expect(editorKeydown).not.toHaveBeenCalled();

        fireEvent.keyDown(editor, { key: "Enter", bubbles: true, cancelable: true });
        expect(closeWindow).toHaveBeenCalledOnce();
        expect(editorKeydown).toHaveBeenCalledOnce();
    });
});
