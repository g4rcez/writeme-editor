import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	clearSuppressedNoteRouteTabOpens,
	suppressNoteRouteTabOpen,
} from "@/lib/note-route-tab-open-suppression";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note, NoteType } from "@/store/note";
import { useUIStore } from "@/store/ui.store";
import NotePage from "./note.page";

vi.mock("@/store/global.store", () => ({
	repositories: {
		notes: {
			getOne: vi.fn(),
			updateContent: vi.fn(),
		},
	},
	useGlobalStore: vi.fn(),
}));

vi.mock("@/store/ui.store", () => ({
	useUIStore: vi.fn(),
}));

vi.mock("@/lib/is-electron", () => ({
	isElectron: () => false,
}));

vi.mock("../editor", () => ({
	Editor: () => <div data-testid="editor" />,
}));

vi.mock("../components/excalidraw-note-view", () => ({
	ExcalidrawNoteView: () => <div data-testid="excalidraw-note-view" />,
}));

vi.mock("../components/note-footer", () => ({
	NoteFooter: () => <div data-testid="note-footer" />,
}));

vi.mock("../components/table-of-contents", () => ({
	TableOfContents: () => <div data-testid="table-of-contents" />,
}));

vi.mock("../elements/json-graph/json-graph", () => ({
	JsonGraph: () => <div data-testid="json-graph" />,
}));

type Deferred<T> = {
	promise: Promise<T>;
	resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
	let resolve: (value: T) => void = () => {};
	const promise = new Promise<T>((resolver) => {
		resolve = resolver;
	});
	return { promise, resolve };
}

function createDispatch() {
	return {
		addTab: vi.fn().mockResolvedValue(undefined),
		setNote: vi.fn(),
		updateNoteContent: vi.fn().mockResolvedValue(undefined),
	};
}

function createNote(id = "note-1", noteType = NoteType.note): Note {
	return Note.parse({ id, title: "Loaded note", content: "Content", noteType });
}

function createNoteTab(noteId = "note-1") {
	return { id: "tab-1", noteId, type: "tab" };
}

function renderNoteRoute() {
	render(
		<MemoryRouter initialEntries={["/note/note-1"]}>
			<Routes>
				<Route path="/note/:noteId" element={<NotePage />} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("NotePage route loading", () => {
	afterEach(() => {
		clearSuppressedNoteRouteTabOpens();
		vi.clearAllMocks();
	});

	it("opens a tab after the route note is loaded", async () => {
		const dispatch = createDispatch();
		vi.mocked(useGlobalStore).mockReturnValue([
			{ note: null, tabs: [] },
			dispatch,
		] as never);
		vi.mocked(useUIStore).mockReturnValue([{ error: null }, {}] as never);
		const note = createNote();
		vi.mocked(repositories.notes.getOne).mockResolvedValue(note);

		renderNoteRoute();

		await waitFor(() => {
			expect(dispatch.addTab).toHaveBeenCalledWith("note-1");
		});
		expect(dispatch.setNote).toHaveBeenCalledWith(note);
	});

	it("does not reopen a route note that already has a tab", () => {
		const dispatch = createDispatch();
		vi.mocked(useGlobalStore).mockReturnValue([
			{ note: createNote("note-1", NoteType.excalidraw), tabs: [createNoteTab()] },
			dispatch,
		] as never);
		vi.mocked(useUIStore).mockReturnValue([{ error: null }, {}] as never);

		renderNoteRoute();

		expect(repositories.notes.getOne).not.toHaveBeenCalled();
		expect(dispatch.addTab).not.toHaveBeenCalled();
	});

	it("does not open a suppressed note route while closing its tab", () => {
		const dispatch = createDispatch();
		vi.mocked(useGlobalStore).mockReturnValue([
			{ note: null, tabs: [] },
			dispatch,
		] as never);
		vi.mocked(useUIStore).mockReturnValue([{ error: null }, {}] as never);
		suppressNoteRouteTabOpen("note-1");

		renderNoteRoute();

		expect(repositories.notes.getOne).not.toHaveBeenCalled();
		expect(dispatch.addTab).not.toHaveBeenCalled();
	});

	it("does not reopen a tab when the note route unmounts before loading finishes", async () => {
		const dispatch = createDispatch();
		vi.mocked(useGlobalStore).mockReturnValue([
			{ note: null, tabs: [] },
			dispatch,
		] as never);
		vi.mocked(useUIStore).mockReturnValue([{ error: null }, {}] as never);
		const pendingNote = createDeferred<Note | null>();
		vi.mocked(repositories.notes.getOne).mockReturnValue(pendingNote.promise);

		const { unmount } = render(
			<MemoryRouter initialEntries={["/note/note-1"]}>
				<Routes>
					<Route path="/note/:noteId" element={<NotePage />} />
				</Routes>
			</MemoryRouter>,
		);

		unmount();
		pendingNote.resolve(createNote());
		await pendingNote.promise;

		expect(dispatch.addTab).not.toHaveBeenCalled();
		expect(dispatch.setNote).not.toHaveBeenCalled();
	});
});
