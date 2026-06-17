import { Modal, Button, Input } from "@g4rcez/components";
import { Shortcut } from "@g4rcez/components/components/display/shortcut";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { FilePlusIcon } from "@phosphor-icons/react/dist/csr/FilePlus";
import { FolderPlusIcon } from "@phosphor-icons/react/dist/csr/FolderPlus";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { TreeStructureIcon } from "@phosphor-icons/react/dist/csr/TreeStructure";
import { useCallback, useEffect, useState } from "react";
import { getDirname } from "@/lib/file-utils";
import { useGlobalStore } from "@/store/global.store";
import { useUIStore } from "@/store/ui.store";
import { repositories } from "@/store/repositories";
import { Note } from "@/store/note";
import type { TreeNode } from "@/types/tree";
import { TreeView } from "./tree-view";

export const DirectoryBrowserDialog = () => {
	const [state, dispatch] = useGlobalStore();
	const map = new Map(state.notes.map((x) => [x.filePath!, x]));
	const [, uiDispatch] = useUIStore();
	const [storageDir, setStorageDir] = useState<string | null>(null);
	const [focusedNode, setFocusedNode] = useState<TreeNode | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);
	const [searchQuery, setSearchQuery] = useState("");

	const refreshView = useCallback(() => {
		setRefreshKey((prev) => prev + 1);
	}, []);

	useEffect(() => {
		if (state.directoryBrowserDialog) {
			if (state.directory) return void setStorageDir(state.directory);
			window.electronAPI.env.getHome().then(setStorageDir);
		}
	}, [state.directoryBrowserDialog, state.directory]);

	const closeDialog = useCallback(() => {
		dispatch.directoryBrowserDialog(false);
	}, [dispatch]);

	const handleFileSelect = async (node: TreeNode) => {
		if (node.extension !== ".md") return;
		try {
			const result = await window.electronAPI.fs.readFile(node.path);
			if (!result.success) {
				console.error("Failed to read file:", result.error);
				return;
			}
			const title = node.name.replace(/\.md$/, "");
			const allNotes = await repositories.notes.getAll();
			const existingNote = allNotes.find((n) => n.filePath === node.path);
			if (existingNote) {
				const fullNote = await repositories.notes.getOne(existingNote.id);
				if (fullNote) {
					dispatch.note(fullNote);
					closeDialog();
					return;
				}
			}
			const newNote = Note.new(title, result.content);
			newNote.filePath = node.path;
			newNote.fileSize = result.fileSize;
			newNote.lastSynced = new Date(result.lastModified);
			await repositories.notes.save(newNote);
			dispatch.note(newNote);
			closeDialog();
		} catch (error) {
			console.error("Error opening file:", error);
		}
	};

	const handleDelete = async (node: TreeNode): Promise<boolean> => {
		const isDir = node.type === "directory";
		try {
			if (!isDir) {
				const allNotes = await repositories.notes.getAll();
				const existingNote = allNotes.find((n) => n.filePath === node.path);

				if (existingNote) {
					await dispatch.deleteNote(existingNote.id);
					refreshView();
					return true;
				}
			} else {
				const allNotes = await repositories.notes.getAll();
				const notesInDir = allNotes.filter((n) =>
					n.filePath?.startsWith(node.path + "/"),
				);
				for (const note of notesInDir) {
					await dispatch.deleteNote(note.id);
				}
			}
			const result = await window.electronAPI.fs.deleteFile(node.path);
			if (
				result === true ||
				(typeof result === "object" && result && result.success)
			) {
				refreshView();
				return true;
			} else {
				console.error("Failed to delete:", result?.error || "Unknown error");
				return false;
			}
		} catch (error) {
			console.error("Error deleting:", error);
			return false;
		}
	};

	const handleCreateFile = useCallback(async () => {
		if (!storageDir) return;

		let parentPath = storageDir;
		if (focusedNode) {
			parentPath =
				focusedNode.type === "directory"
					? focusedNode.path
					: getDirname(focusedNode.path);
		}

		uiDispatch.setPrompt({
			open: true,
			title: "New File",
			message: "Enter new file name (e.g. note.md):",
			placeholder: "note.md",
			onConfirm: async (fileName) => {
				if (!fileName) return;
				try {
					const newPath = `${parentPath}/${fileName.endsWith(".md") ? fileName : fileName + ".md"}`;
					const result = await window.electronAPI.fs.writeFile(newPath, "");
					if (result.success) {
						refreshView();
					} else {
						console.error("Failed to create file:", result.error);
					}
				} catch (error) {
					console.error("Error creating file:", error);
				}
			},
		});
	}, [storageDir, focusedNode, refreshView, uiDispatch]);

	const handleCreateFolder = useCallback(async () => {
		if (!storageDir) return;

		let parentPath = storageDir;
		if (focusedNode) {
			parentPath =
				focusedNode.type === "directory"
					? focusedNode.path
					: getDirname(focusedNode.path);
		}

		uiDispatch.setPrompt({
			open: true,
			title: "New Folder",
			message: "Enter new folder name:",
			onConfirm: async (folderName) => {
				if (!folderName) return;
				try {
					const newPath = `${parentPath}/${folderName}`;
					const result = await window.electronAPI.fs.mkdir(newPath);
					if (result.success) {
						refreshView();
					} else {
						console.error("Failed to create folder:", result.error);
					}
				} catch (error) {
					console.error("Error creating folder:", error);
				}
			},
		});
	}, [storageDir, focusedNode, refreshView, uiDispatch]);

	const handleMove = useCallback(async () => {
		if (!focusedNode) return;

		uiDispatch.setPrompt({
			open: true,
			title: "Move/Rename",
			message: `Move/Rename "${focusedNode.name}" to:`,
			initialValue: focusedNode.path,
			onConfirm: async (newPath) => {
				if (!newPath || newPath === focusedNode.path) return;

				try {
					// If it's a markdown file, sync IndexedDB
					if (focusedNode.extension === ".md") {
						const allNotes = await repositories.notes.getAll();
						const existingNote = allNotes.find(
							(n) => n.filePath === focusedNode.path,
						);

						if (existingNote) {
							const fullNote = await repositories.notes.getOne(existingNote.id);
							if (fullNote) {
								const oldDir = getDirname(focusedNode.path);
								const newDir = getDirname(newPath);
								if (oldDir === newDir) {
									const newTitle = newPath
										.split(/[/\\]/)
										.pop()
										?.replace(/\.md$/, "");
									if (newTitle) fullNote.title = newTitle;
								}
								fullNote.filePath = newPath;
								await repositories.notes.update(fullNote.id, fullNote);
								refreshView();
								return;
							}
						}
					} else if (focusedNode.type === "directory") {
						// If it's a directory, update all notes contained within it
						const allNotes = await repositories.notes.getAll();
						const notesInDir = allNotes.filter((n) =>
							n.filePath?.startsWith(focusedNode.path + "/"),
						);

						// Physically move first
						const result = await window.electronAPI.fs.moveFile(
							focusedNode.path,
							newPath,
						);
						if (result.success) {
							// Update paths in DB
							for (const note of notesInDir) {
								const relativePart = note.filePath!.substring(
									focusedNode.path.length,
								);
								const updatedNote = await repositories.notes.getOne(note.id);
								if (updatedNote) {
									updatedNote.filePath = newPath + relativePart;
									await repositories.notes.update(updatedNote.id, updatedNote);
								}
							}
							refreshView();
						} else {
							console.error("Failed to move directory:", result.error);
						}
						return;
					}

					// Fallback for non-note files or if not in DB
					const result = await window.electronAPI.fs.moveFile(
						focusedNode.path,
						newPath,
					);
					if (result.success) {
						refreshView();
					} else {
						console.error("Failed to move:", result.error);
					}
				} catch (error) {
					console.error("Error moving:", error);
				}
			},
		});
	}, [focusedNode, refreshView, uiDispatch]);

	// Keyboard shortcuts for modal-level actions
	useEffect(() => {
		if (!state.directoryBrowserDialog) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			// Don't trigger if user is typing in a prompt (though prompts are blocking,
			// some browser environments or future non-blocking versions might need this)
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			) {
				return;
			}

			switch (e.key.toLowerCase()) {
				case "n":
					e.preventDefault();
					handleCreateFolder();
					break;
				case "t":
					e.preventDefault();
					handleCreateFile();
					break;
				case "m":
					if (focusedNode) {
						e.preventDefault();
						handleMove();
					}
					break;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		state.directoryBrowserDialog,
		handleCreateFile,
		handleCreateFolder,
		handleMove,
		focusedNode,
	]);

	return (
		<Modal
			open={state.directoryBrowserDialog}
			onChange={(val) => dispatch.directoryBrowserDialog(val)}
			title="Browse Files"
			className="max-w-6xl"
			bodyClassName="overflow-hidden p-0"
		>
			<div className="flex h-[68vh] min-h-96 flex-col overflow-hidden">
				<header className="border-b border-floating-border px-6 py-5">
					<div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
						<div className="flex min-w-0 items-center gap-3">
							<span className="flex size-9 shrink-0 items-center justify-center rounded-button-radius bg-primary/10 text-primary">
								<TreeStructureIcon className="size-5" />
							</span>
							<div className="min-w-0">
								<p className="text-sm font-semibold text-foreground">
									Select a file to open
								</p>
								<p className="mt-0.5 text-xs text-muted-foreground">
									Open markdown files or manage workspace folders in place.
								</p>
							</div>
						</div>

						<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
							<span>Move</span>
							<Shortcut value="↑ ↓" />
							<span>Open</span>
							<Shortcut value="Enter" />
							<span>Delete</span>
							<Shortcut value="Del" />
						</div>
					</div>

					<div className="flex flex-col gap-3 xl:flex-row xl:items-center">
						<div className="min-w-0 flex-1">
							<Input
								type="text"
								title="Search files"
								hiddenLabel
								left={
									<MagnifyingGlassIcon className="size-4 text-muted-foreground" />
								}
								placeholder="Search files and folders..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<Button
								size="small"
								theme="muted"
								onClick={handleCreateFile}
								className="gap-2"
								title="New File (T)"
							>
								<FilePlusIcon className="size-4" />
								<span>File</span>
								<Shortcut value="T" />
							</Button>
							<Button
								size="small"
								theme="muted"
								onClick={handleCreateFolder}
								className="gap-2"
								title="New Folder (N)"
							>
								<FolderPlusIcon className="size-4" />
								<span>Folder</span>
								<Shortcut value="N" />
							</Button>
							<Button
								size="small"
								theme="muted"
								onClick={handleMove}
								disabled={!focusedNode}
								className="gap-2 disabled:opacity-40"
								title="Move/Rename (M)"
							>
								<PencilSimpleIcon className="size-4" />
								<span>Move</span>
								<Shortcut value="M" />
							</Button>
						</div>
					</div>

					<div className="mt-3 flex min-w-0 items-center gap-2 rounded-button-radius border border-card-border bg-muted/35 px-3 py-2 text-xs">
						<span className="shrink-0 font-medium text-muted-foreground">
							Workspace
						</span>
						<span className="min-w-0 truncate font-mono text-foreground">
							{storageDir ?? "Loading..."}
						</span>
					</div>
				</header>

				<div className="min-h-0 flex-1 overflow-y-auto bg-background scrollbar-thin">
					{storageDir ? (
						<div className="p-3">
							<TreeView
								map={map}
								rootPath={storageDir}
								onDelete={handleDelete}
								searchQuery={searchQuery}
								onFocusChange={setFocusedNode}
								onFileSelect={handleFileSelect}
								key={`${storageDir}-${refreshKey}`}
							/>
						</div>
					) : (
						<div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
							<div>
								<p className="font-medium text-foreground">
									No storage directory configured.
								</p>
								<p className="mt-2 text-sm">
									Please set up your workspace first.
								</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</Modal>
	);
};
