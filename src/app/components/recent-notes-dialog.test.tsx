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

vi.mock("@g4rcez/components/components/display/shortcut", () => ({
	Shortcut: ({ value }: { value: string }) => <kbd>{value}</kbd>,
}));

// Mock @g4rcez/components
vi.mock("@g4rcez/components", async () => {
	const React = await vi.importActual<typeof import("react")>("react");

	return {
		css: (...classes: Array<string | false | null | undefined>) =>
			classes.filter(Boolean).join(" "),
		Empty: ({ message }: { message: string }) => <div>{message}</div>,
		Input: React.forwardRef<HTMLInputElement, any>(function Input(
			{ left, right, title, hiddenLabel, ...props },
			ref,
		) {
			return (
				<label>
					{hiddenLabel ? null : <span>{title}</span>}
					{left}
					<input
						ref={ref}
						aria-label={hiddenLabel ? title : undefined}
						{...props}
					/>
					{right}
				</label>
			);
		}),
		Shortcut: ({ value }: { value: string }) => <kbd>{value}</kbd>,
		Modal: ({ children, title, open }: any) =>
			open ? (
				<div data-testid="modal">
					<h1>{title}</h1>
					{children}
				</div>
			) : null,
	};
});

describe("RecentNotesDialog", () => {
	const mockDispatch = {
		recentNotesDialog: vi.fn(),
		loadRecentNotes: vi.fn(),
		selectNoteById: vi.fn(),
	};

	const mockState = {
		recentNotesDialog: true,
		recentNotes: [
			{
				id: "1",
				title: "Note 1",
				filePath: "/path/to/note1.md",
				updatedAt: new Date().toISOString(),
			},
			{
				id: "2",
				title: "Note 2",
				filePath: "/path/to/note2.md",
				updatedAt: new Date().toISOString(),
			},
		],
	};

	beforeEach(() => {
		vi.clearAllMocks();
		(useGlobalStore as any).mockReturnValue([mockState, mockDispatch]);
		(SettingsService.load as any).mockReturnValue({
			directory: "/path/to",
		});
	});

	it("should render the dialog when open", () => {
		render(
			<MemoryRouter>
				<RecentNotesDialog />
			</MemoryRouter>,
		);
		expect(screen.getByText("Recent Notes")).toBeDefined();
		expect(
			screen.getByPlaceholderText("Search title or folder..."),
		).toBeDefined();
		expect(screen.getByText("Note 1")).toBeDefined();
		expect(screen.getByText("Note 2")).toBeDefined();
	});

	it("should filter notes based on search query", async () => {
		render(
			<MemoryRouter>
				<RecentNotesDialog />
			</MemoryRouter>,
		);
		const input = screen.getByPlaceholderText("Search title or folder...");
		fireEvent.change(input, { target: { value: "Note 1" } });

		expect(screen.getByText("Note 1")).toBeDefined();
		expect(screen.queryByText("Note 2")).toBeNull();
	});

	it("should call openNote when a note is clicked", () => {
		render(
			<MemoryRouter>
				<RecentNotesDialog />
			</MemoryRouter>,
		);
		const note1 = screen.getByText("Note 1");
		fireEvent.click(note1);

		expect(mockDispatch.recentNotesDialog).toHaveBeenCalledWith(false);
	});
});
