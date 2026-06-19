import { Dates } from "@/lib/dates";
import { getReadingTime } from "@/lib/file-utils";
import { isElectron } from "@/lib/is-electron";
import { isNoteRouteTabOpenSuppressed } from "@/lib/note-route-tab-open-suppression";
import { isNoteTabForNoteId } from "@/lib/tab-target";
import { repositories, useGlobalStore } from "@/store/global.store";
import { printDocument } from "@/lib/print-document";
import { Note, NoteType } from "@/store/note";
import { useUIStore } from "@/store/ui.store";
import { Tag } from "@g4rcez/components";
import { PrinterIcon } from "@phosphor-icons/react/dist/csr/Printer";
import { type PropsWithChildren, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ExcalidrawNoteView } from "../components/excalidraw-note-view";
import { NoteFooter } from "../components/note-footer";
import { TableOfContents } from "../components/table-of-contents";
import { Editor } from "../editor";
import { JsonGraph } from "../elements/json-graph/json-graph";

function useNoteReferences(content: string) {
	const [refs, setRefs] = useState<Note[]>([]);
	useEffect(() => {
		let cancelled = false;
		async function resolve() {
			const ids = new Set<string>();

			for (const m of content.matchAll(
				/\[([^\]]+)\]\([^)]*"writeme-mention:([^"]+)"\)/g,
			)) {
				ids.add(m![2]!);
			}
			for (const m of content.matchAll(/app:\/\/note\/([^\s<>"')\]]+)/g)) {
				ids.add(m![1]!);
			}

			const wikiMatches = [...content.matchAll(/\[\[([^\]]+)\]\]/g)];
			if (wikiMatches.length > 0) {
				const allNotes = await repositories.notes.getAll();
				const byTitle = new Map(allNotes.map((n) => [n.title, n.id]));
				const byId = new Set(allNotes.map((n) => n.id));
				for (const m of wikiMatches) {
					const raw = m[1]!;
					if (byId.has(raw)) ids.add(raw);
					else if (byTitle.has(raw)) ids.add(byTitle.get(raw)!);
				}
			}
			const settled = await Promise.all(
				[...ids].map((id) => repositories.notes.getOne(id)),
			);
			if (!cancelled) setRefs(settled.filter((n): n is Note => n != null));
		}
		resolve();
		return () => {
			cancelled = true;
		};
	}, [content]);

	return refs;
}

function NoteReferences({ note }: { note: Note }) {
	const refs = useNoteReferences(note.content ?? "");
	if (refs.length === 0) return null;
	return (
		<footer className="flex flex-col gap-2 my-4 py-4 border-t border-card-border">
			<p className="text-sm font-medium text-muted-foreground">Linked notes</p>
			<ul className="flex flex-wrap gap-2">
				{refs.map((ref) => (
					<li key={ref.id}>
						<Link
							to={`/note/${ref.id}`}
							className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
						>
							{ref.title || ref.id}
						</Link>
					</li>
				))}
			</ul>
		</footer>
	);
}

const Wrapper = (props: PropsWithChildren) => {
	return (
		<div className="writeme-editor-page">
			<TableOfContents />
			{props.children}
		</div>
	);
};

function PrintableNoteHeader({ note }: { note: Note }) {
	return (
		<header className="hidden print:block writeme-print-header">
			<h1 className="writeme-print-title">{note.title}</h1>
			<p className="writeme-print-meta">
				Updated {Dates.yearMonthDay(note.updatedAt)}
			</p>
		</header>
	);
}

function ExportNoteButton({ note }: { note: Note }) {
	return (
		<button
			type="button"
			aria-label={`Export ${note.title}`}
			title="Export document (print or save as PDF)"
			onClick={() => printDocument({ title: note.title })}
			className="writeme-print-export-button fixed right-5 top-6 z-50 flex size-11 items-center justify-center rounded-button-radius border border-card-border bg-card-background text-muted-foreground shadow-soft transition-[background-color,border-color,color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:hidden"
		>
			<PrinterIcon aria-hidden="true" size={21} />
		</button>
	);
}

export default function NotePage() {
	const [uiState] = useUIStore();
	const [state, dispatch] = useGlobalStore();
	const params = useParams<{ noteId: string }>();
	const id = params.noteId;
	const note = state.note;
	const hasRouteNoteTab = id
		? state.tabs.some((tab) => isNoteTabForNoteId(tab, id))
		: false;
	const isLoading = note === null;

	useEffect(() => {
		if (!id || isNoteRouteTabOpenSuppressed(id)) return;

		let cancelled = false;

		const openRouteNote = async (): Promise<void> => {
			if (id === state.note?.id) {
				if (!hasRouteNoteTab) await dispatch.addTab(id);
				return;
			}

			const note = await repositories.notes.getOne(id);
			if (cancelled) return;

			if (!note) {
				dispatch.setNote(null);
				return;
			}

			await dispatch.addTab(id);
			if (cancelled) return;
			dispatch.setNote(note);
		};

		void openRouteNote();

		return () => {
			cancelled = true;
		};
	}, [dispatch, hasRouteNoteTab, id, state.note?.id]);

	useEffect(() => {
		if (!isElectron() || !note?.filePath) return;
		const filePath = note.filePath;
		return window.electronAPI.fs.onFileChanged(
			async ({ filePath: changedPath }) => {
				if (changedPath !== filePath) return;
				const result = await window.electronAPI.fs.readFile(changedPath);
				if (!result.success) return;
				if (result.content !== note.content) {
					dispatch.setNote(Note.parse({ ...note, content: result.content }));
				}
			},
		);
	}, [note?.filePath, note?.id]);

	if (isLoading) {
		return (
			<div className="flex justify-center items-center p-8">
				Fetching note...
			</div>
		);
	}

	if (uiState.error && note === null) {
		return (
			<div className="flex flex-col gap-4 justify-center items-center p-8">
				<span className="text-lg font-medium capitalize">Note not found</span>
				<Link to="/">Go to dashboard</Link>
			</div>
		);
	}

	const isJson = note.noteType === NoteType.json;
	const isExcalidraw = note.noteType === NoteType.excalidraw;

	if (isJson || isExcalidraw) {
		return (
			<div className="-my-8 flex h-[calc(100%+4rem)] min-h-0 w-full bg-background">
				{isJson ? (
					<JsonGraph
						key={note.id}
						json={(() => {
							try {
								return JSON.parse(note.content);
							} catch {
								return { error: "Failed to parse JSON", raw: note.content };
							}
						})()}
						onChange={(newJson) => {
							const content = JSON.stringify(newJson, null, 2);
							repositories.notes.updateContent(note.id, content);
							dispatch.updateNoteContent(note.id, content);
						}}
					/>
				) : (
					<ExcalidrawNoteView note={note} />
				)}
			</div>
		);
	}

	return (
		<Wrapper>
			<ExportNoteButton note={note} />
			<PrintableNoteHeader note={note} />
			{note.noteType === "read-it-later" ? (
				<header className="flex flex-col gap-2 py-4 mx-auto w-full border-b max-w-safe border-card-border print:hidden">
					<h1 className="text-xl font-medium">{note.title}</h1>
					{note.url ? (
						<a
							target="_blank"
							className="link"
							href={note.url}
							rel="noopener noreferrer nofollow"
						>
							{new URL(note.url).hostname}
						</a>
					) : null}
					<span className="flex gap-2 items-center text-sm">
						<Tag size="small">Read it later</Tag>-
						<time dateTime={note.createdAt.toISOString()}>
							{Dates.yearMonthDay(note.createdAt)}
						</time>
						-<i>{getReadingTime(note.content).formatted}</i>
					</span>
				</header>
			) : null}

			<Editor note={note} key={note.id} content={note.content || ""} />
			<NoteReferences note={note} />
			<NoteFooter noteId={note.id} />
		</Wrapper>
	);
}
