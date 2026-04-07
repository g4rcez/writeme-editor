import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RecentNotesDialog } from "./recent-notes-dialog";
import { useGlobalStore } from "../../store/global.store";
import { SettingsService } from "../../store/settings";

// Mock global store
vi.mock("../../store/global.store", () => ({
  useGlobalStore: vi.fn(),
}));

// Mock settings repository
vi.mock("../../store/settings", () => ({
  SettingsService: {
    load: vi.fn(),
  },
}));

// Mock @g4rcez/components
vi.mock("@g4rcez/components", () => ({
  Modal: ({ children, title, open }: any) => 
    open ? (
      <div data-testid="modal">
        <h1>{title}</h1>
        {children}
      </div>
    ) : null,
}));

describe("RecentNotesDialog", () => {
  const mockDispatch = {
    recentNotesDialog: vi.fn(),
    loadRecentNotes: vi.fn(),
    selectNoteById: vi.fn(),
  };

  const mockState = {
    recentNotesDialog: true,
    recentNotes: [
      { id: "1", title: "Note 1", filePath: "/path/to/note1.md", updatedAt: new Date().toISOString() },
      { id: "2", title: "Note 2", filePath: "/path/to/note2.md", updatedAt: new Date().toISOString() },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useGlobalStore as any).mockReturnValue([mockState, mockDispatch]);
    (SettingsService.load as any).mockReturnValue({ storageDirectory: "/path/to" });
  });

  it("should render the dialog when open", () => {
    render(
      <MemoryRouter>
        <RecentNotesDialog />
      </MemoryRouter>
    );
    expect(screen.getByText("Recent Notes")).toBeDefined();
    expect(screen.getByPlaceholderText("Search recent notes...")).toBeDefined();
    expect(screen.getByText("Note 1")).toBeDefined();
    expect(screen.getByText("Note 2")).toBeDefined();
  });

  it("should filter notes based on search query", async () => {
    render(
      <MemoryRouter>
        <RecentNotesDialog />
      </MemoryRouter>
    );
    const input = screen.getByPlaceholderText("Search recent notes...");
    fireEvent.change(input, { target: { value: "Note 1" } });
    
    expect(screen.getByText("Note 1")).toBeDefined();
    expect(screen.queryByText("Note 2")).toBeNull();
  });

  it("should call openNote when a note is clicked", () => {
    render(
      <MemoryRouter>
        <RecentNotesDialog />
      </MemoryRouter>
    );
    const note1 = screen.getByText("Note 1");
    fireEvent.click(note1);
    
    expect(mockDispatch.recentNotesDialog).toHaveBeenCalledWith(false);
  });
});
