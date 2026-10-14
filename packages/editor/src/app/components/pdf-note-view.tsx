import { Button } from "@g4rcez/components";
import { TextLayer, type PDFDocumentLoadingTask, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import type { Note } from "@/store/note";
import { loadPdfDocument } from "@/lib/pdf-document";
import { readPdfAsset } from "@/lib/pdf-import";
import { parsePdfNote } from "@/lib/pdf-note";
import { FreehandNoteView } from "./freehand-note-view";
import { SendResearchExcerpt } from "./send-research-excerpt";

function PdfPage({
    document,
    pageNumber,
    noteId,
}: {
    document: PDFDocumentProxy;
    pageNumber: number;
    noteId: string;
}): JSX.Element {
    const container = useRef<HTMLDivElement>(null);
    const canvasHost = useRef<HTMLDivElement>(null);
    const textHost = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [renderedWidth, setRenderedWidth] = useState(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const element = container.current;
        if (!element) return;
        const observer = new ResizeObserver(() => setWidth(Math.round(element.getBoundingClientRect().width)));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!width || !canvasHost.current || !textHost.current) return;
        let cancelled = false;
        let render: RenderTask | undefined;
        let textLayer: TextLayer | undefined;
        const canvas = window.document.createElement("canvas");
        const text = window.document.createElement("div");
        text.className = "wm-pdf-text-layer";
        canvasHost.current.replaceChildren(canvas);
        textHost.current.replaceChildren(text);

        async function paint(): Promise<void> {
            try {
                const page = await document.getPage(pageNumber);
                if (cancelled) return;
                const original = page.getViewport({ scale: 1 });
                const viewport = page.getViewport({ scale: width / original.width });
                const outputScale = Math.min(2, window.devicePixelRatio || 1);
                canvas.width = Math.ceil(viewport.width * outputScale);
                canvas.height = Math.ceil(viewport.height * outputScale);
                const context = canvas.getContext("2d");
                if (!context) throw new Error("Could not render this PDF page");
                render = page.render({
                    canvas,
                    canvasContext: context,
                    viewport,
                    transform: [outputScale, 0, 0, outputScale, 0, 0],
                });
                await render.promise;
                if (cancelled) return;
                text.style.setProperty("--scale-factor", String(viewport.scale));
                text.style.setProperty("--total-scale-factor", String(viewport.scale));
                textLayer = new TextLayer({
                    textContentSource: await page.getTextContent(),
                    container: text,
                    viewport,
                });
                if (cancelled) return;
                await textLayer.render();
                if (!cancelled) {
                    setError(null);
                    setRenderedWidth(width);
                }
            } catch (reason) {
                if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not render this PDF page");
            }
        }
        void paint();
        return () => {
            cancelled = true;
            render?.cancel();
            textLayer?.cancel();
        };
    }, [document, pageNumber, width]);

    return (
        <div
            ref={container}
            className="wm-pdf-page"
            aria-label={`PDF page ${pageNumber}`}
            data-research-source={noteId}
            data-pdf-page={pageNumber}
            data-pdf-ready={renderedWidth === width && width > 0 && !error}
        >
            <div ref={canvasHost} className="wm-pdf-image" aria-hidden="true" />
            <div ref={textHost} />
            {error || !width || renderedWidth !== width ? (
                <output className="wm-pdf-loading" role={error ? "alert" : undefined}>
                    {error ?? "Loading PDF page…"}
                </output>
            ) : null}
        </div>
    );
}

export function PdfNoteView({ note, actions }: { note: Note; actions?: ReactNode }): JSX.Element {
    const location = useLocation();
    const [sourceNote] = useState(note);
    const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
    const [fingerprint, setFingerprint] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
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
                <Button
                    onClick={() => {
                        setError(null);
                        setAttempt(attempt + 1);
                    }}
                >
                    Retry
                </Button>
            </div>
        );
    if (!document) return <output className="block p-6 text-foreground">Opening PDF…</output>;
    const params = new URLSearchParams(location.search);
    const requestedPage = Number(params.get("page") ?? 1);
    if (
        (params.has("pdf") && params.get("pdf") !== fingerprint) ||
        !Number.isInteger(requestedPage) ||
        requestedPage < 1 ||
        requestedPage > document.numPages
    ) {
        return (
            <div role="alert" className="flex flex-col gap-4 p-6 text-foreground">
                <p>
                    The source PDF has been replaced or this page is no longer available. The quotation is still saved
                    in your writing note.
                </p>
                <Button
                    onClick={() => {
                        window.history.back();
                    }}
                >
                    Return to writing
                </Button>
            </div>
        );
    }
    return (
        <FreehandNoteView
            note={note}
            actions={actions}
            selectionAction={<SendResearchExcerpt source={{ kind: "pdf", note, page: requestedPage, fingerprint }} />}
            initialPageIndex={requestedPage - 1}
            fixedPages
            pageBackground={(pageIndex) => (
                <PdfPage key={pageIndex} document={document} pageNumber={pageIndex + 1} noteId={note.id} />
            )}
        />
    );
}
