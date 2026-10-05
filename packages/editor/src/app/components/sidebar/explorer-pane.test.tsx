import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExplorerPane } from "./explorer-pane";

const mocks = vi.hoisted(() => ({
    chooseDirectory: vi.fn(),
    migrateNotes: vi.fn(),
    switchWorkspace: vi.fn(),
    state: { notes: [] as unknown[], explorerRoot: null, note: null },
}));

vi.mock("@g4rcez/components", () => ({
    Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
        <button type="button" onClick={onClick}>
            {children}
        </button>
    ),
    Input: () => null,
}));

vi.mock("@/app/contexts/layout-context", () => ({
    useLayoutStore: () => [{ searchQuery: "" }, { setSearch: vi.fn() }],
}));

vi.mock("@/app/lib/open-directory-as-workspace", () => ({
    migrateWebOnlyNotesToDirectory: mocks.migrateNotes,
}));

vi.mock("@/lib/is-electron", () => ({ isElectron: () => true }));

vi.mock("@/store/global.store", () => ({
    globalDispatch: {
        deleteNote: vi.fn(),
        notes: vi.fn(),
        setNote: vi.fn(),
        switchWorkspace: mocks.switchWorkspace,
    },
    repositories: { notes: { getAll: vi.fn(), save: vi.fn() } },
    useGlobalStore: () => [mocks.state],
}));

vi.mock("@/store/note", () => ({ Note: { new: vi.fn() }, NoteType: { json: "json" } }));
vi.mock("@/store/ui.store", () => ({ useUIStore: () => [{}, { openMediaPreview: vi.fn() }] }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("../note-list/note-list-sidebar", () => ({ NoteListSidebar: () => null }));
vi.mock("../tree-view", () => ({ TreeView: () => null }));

describe("ExplorerPane folder opening", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.chooseDirectory.mockResolvedValue("/workspace");
        mocks.migrateNotes.mockResolvedValue(undefined);
        Object.assign(mocks.state, { notes: [], explorerRoot: null, note: null });
        Object.defineProperty(window, "electronAPI", {
            configurable: true,
            value: { fs: { chooseDirectory: mocks.chooseDirectory } },
        });
    });

    it("migrates local-only notes before switching to the selected folder", async () => {
        let finishMigration!: () => void;
        const migration = new Promise<void>((resolve) => {
            finishMigration = resolve;
        });
        mocks.migrateNotes.mockReturnValue(migration);

        render(<ExplorerPane />);
        fireEvent.click(screen.getByRole("button", { name: "Open folder" }));

        await waitFor(() => expect(mocks.migrateNotes).toHaveBeenCalledWith("/workspace"));
        expect(mocks.switchWorkspace).not.toHaveBeenCalled();

        finishMigration();
        await waitFor(() => expect(mocks.switchWorkspace).toHaveBeenCalledWith("/workspace"));
    });
});
