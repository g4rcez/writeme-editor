import { Button } from "@g4rcez/components";
import { type PDFDocumentLoadingTask, type PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useState, type JSX, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import type { ResearchExcerptSource } from "@/lib/research-excerpt";
import type { Note } from "@/store/note";
import { loadPdfDocument } from "@/lib/pdf-document";
import { readPdfAsset } from "@/lib/pdf-import";
import { parsePdfNote } from "@/lib/pdf-note";
import { FreehandNoteView } from "./freehand-note-view";
import { PdfPage } from "./pdf-page";
import { SendResearchExcerpt } from "./send-research-excerpt";

export function PdfNoteView({ note, actions }: { note: Note; actions?: ReactNode }): JSX.Element {
    const location = useLocation();
    const [sourceNote] = useState(note);
    const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
    const [fingerprint, setFingerprint] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    function retryLoading(): void {
        setError(null);
        setAttempt(attempt + 1);
    }

    function returnToWriting(): void {
        window.history.back();
    }

    useEffect(() => {
        let cancelled = false;
        let loading: PDFDocumentLoadingTask | undefined;
        async function open(): Promise<void> {
            try {
                const notebook = parsePdfNote(sourceNote.content);
                const data = await readPdfAsset(sourceNote, notebook);
                const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(data).buffer);
                const identity = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
                    "",
                );
                if (cancelled) return;
                loading = loadPdfDocument(data);
                const pdf = await loading.promise;
                if (pdf.numPages !== notebook.pages.length)
                    throw new Error("The PDF no longer matches its saved annotation pages");
                if (!cancelled) {
                    setFingerprint(identity);
                    setDocument(pdf);
                }
            } catch (reason) {
                if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not open PDF");
            }
        }
        void open();
        return () => {
            cancelled = true;
            void loading?.destroy();
        };
    }, [sourceNote, attempt]);

    if (error)
        return (
            <div className="flex flex-col items-center gap-4 p-6 text-foreground" role="alert">
                <p>{error}</p>
                <Button onClick={retryLoading}>Retry</Button>
            </div>
        );
    if (!document) return <output className="block p-6 text-foreground">Opening PDF…</output>;
    const loadedDocument = document;
    const params = new URLSearchParams(location.search);
    const requestedPage = Number(params.get("page") ?? 1);
    if (
        (params.has("pdf") && params.get("pdf") !== fingerprint) ||
        !Number.isInteger(requestedPage) ||
        requestedPage < 1 ||
        requestedPage > loadedDocument.numPages
    ) {
        return (
            <div role="alert" className="flex flex-col gap-4 p-6 text-foreground">
                <p>
                    The source PDF has been replaced or this page is no longer available. The quotation is still saved
                    in your writing note.
                </p>
                <Button onClick={returnToWriting}>Return to writing</Button>
            </div>
        );
    }
    const source: ResearchExcerptSource = { kind: "pdf", note, page: requestedPage, fingerprint };
    function renderPdfPage(pageIndex: number): JSX.Element {
        return <PdfPage key={pageIndex} document={loadedDocument} pageNumber={pageIndex + 1} noteId={note.id} />;
    }
    const selectionAction = <SendResearchExcerpt source={source} />;
    return (
        <FreehandNoteView
            fixedPages
            note={note}
            actions={actions}
            initialPageIndex={requestedPage - 1}
            selectionAction={selectionAction}
            pageBackground={renderPdfPage}
        />
    );
}
