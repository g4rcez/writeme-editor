import { TextLayer, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState, type JSX } from "react";

export function PdfPage({
    document,
    pageNumber,
    noteId,
}: {
    document: PDFDocumentProxy;
    pageNumber: number;
    noteId?: string;
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
