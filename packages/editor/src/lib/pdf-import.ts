import { Note, NoteType } from "@/store/note";
import { repositories } from "@/store/repositories";
import { db } from "@/store/repositories/browser/dexie-db";
import { SettingsService } from "@/store/settings";
import { resolveLocalAssetCandidates } from "./attachment-paths";
import { PAPER_WIDTH, type FreehandNotebook } from "./freehand-note";
import { isElectron } from "./is-electron";
import { isMobile } from "./platform";
import { loadPdfDocument } from "./pdf-document";
import { buildPdfNoteContent, type PdfNotebook } from "./pdf-note";

async function encodeFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
            typeof reader.result === "string"
                ? resolve(reader.result.split(",")[1]!)
                : reject(new Error("Could not read PDF"));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

export async function importPdfNote(file: File, title: string): Promise<Note> {
    const data = new Uint8Array(await file.arrayBuffer());
    const loading = loadPdfDocument(data.slice());
    const note = Note.new(title, "", NoteType.pdf);
    const pages: FreehandNotebook["pages"] = [];
    try {
        const document = await loading.promise;
        for (let index = 1; index <= document.numPages; index++) {
            const page = await document.getPage(index);
            const viewport = page.getViewport({ scale: 1 });
            pages.push({ strokes: [], height: (PAPER_WIDTH * viewport.height) / viewport.width });
            page.cleanup();
        }
    } finally {
        await loading.destroy();
    }

    const directory = isElectron() ? SettingsService.load().directory : null;
    const source = directory ? `attachments/${note.id}/document.pdf` : `asset:${note.id}`;
    let stored = false;
    try {
        if (directory) {
            const result = await window.electronAPI.fs.writeBinaryFile(`${directory}/${source}`, data);
            if (!result.success) throw new Error(result.error ?? "Could not store PDF");
        } else if (isElectron()) {
            await window.electronAPI.db.save("pdfAssets", { id: note.id, data: await encodeFile(file) });
        } else {
            await db.pdfAssets.add({ id: note.id, data: isMobile() ? data : new Blob([data], { type: "application/pdf" }) });
        }
        stored = true;
        note.content = buildPdfNoteContent({ version: 1, paper: "blank", pages, pdf: { source, filename: file.name } });
        return await repositories.notes.save(note);
    } catch (reason) {
        const saved = stored ? await repositories.notes.getOne(note.id).catch(() => undefined) : undefined;
        if (stored && saved === null) {
            if (directory) await window.electronAPI.fs.deleteFile(`${directory}/${source}`);
            else if (isElectron()) await window.electronAPI.db.delete("pdfAssets", note.id);
            else await db.pdfAssets.delete(note.id);
        }
        throw reason;
    }
}

export async function readPdfAsset(note: Note, notebook: PdfNotebook): Promise<Uint8Array> {
    const { source } = notebook.pdf;
    if (source.startsWith("asset:")) {
        const id = source.slice(6);
        if (isElectron()) {
            const asset = await window.electronAPI.db.get<{ data: string }>("pdfAssets", id);
            if (!asset) throw new Error("The original PDF could not be found");
            return Uint8Array.from(atob(asset.data), (character) => character.charCodeAt(0));
        }
        const asset = await db.pdfAssets.get(id);
        if (!asset) throw new Error("The original PDF could not be found");
        return asset.data instanceof Uint8Array ? asset.data.slice() : new Uint8Array(await asset.data.arrayBuffer());
    }
    const directory = SettingsService.load().directory;
    if (!isElectron() || !directory) throw new Error("Open the PDF's workspace to read this document");
    for (const path of resolveLocalAssetCandidates({
        src: source,
        projectDir: directory,
        noteFilePath: note.filePath,
    })) {
        const result = await window.electronAPI.fs.readBinaryFile(path);
        if (result.success && result.data) return new Uint8Array(result.data);
    }
    throw new Error("The original PDF could not be found in this workspace");
}
