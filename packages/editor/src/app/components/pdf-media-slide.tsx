import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@g4rcez/components";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { useEffect, useState, type JSX, type PointerEvent } from "react";
import { loadPdfDocument } from "@/lib/pdf-document";
import { PdfPage } from "./pdf-page";

type PdfMediaSlideProps = {
    src: string;
    title: string;
};

export function PdfMediaSlide({ src, title }: PdfMediaSlideProps): JSX.Element {
    const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [pageRatio, setPageRatio] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const loading = loadPdfDocument(src);
        setDocument(null);
        setPageNumber(1);
        setPageRatio(null);
        setError(null);
        void loading.promise.then(
            (pdf) => {
                if (!cancelled) setDocument(pdf);
            },
            (reason: unknown) => {
                if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not open this PDF");
            },
        );
        return () => {
            cancelled = true;
            void loading.destroy();
        };
    }, [src]);

    useEffect(() => {
        if (!document) return;
        let cancelled = false;
        setPageRatio(null);
        void document.getPage(pageNumber).then((page) => {
            if (cancelled) return;
            const viewport = page.getViewport({ scale: 1 });
            setPageRatio(viewport.width / viewport.height);
        });
        return () => {
            cancelled = true;
        };
    }, [document, pageNumber]);

    const pageCount = document?.numPages ?? 1;

    function stopLightboxNavigation(event: PointerEvent<HTMLElement>): void {
        event.stopPropagation();
    }

    function previousPage(): void {
        setPageNumber((current) => Math.max(1, current - 1));
    }

    function nextPage(): void {
        setPageNumber((current) => Math.min(pageCount, current + 1));
    }

    const pageStyle = pageRatio === null ? undefined : { aspectRatio: String(pageRatio) };
    const pageNavigation = document ? (
        <nav className="flex shrink-0 items-center gap-3" aria-label="PDF pages">
            <Button
                type="button"
                theme="ghost-muted"
                size="big"
                aria-label="Previous PDF page"
                disabled={pageNumber <= 1}
                onClick={previousPage}
            >
                <CaretLeftIcon aria-hidden="true" size={20} />
            </Button>
            <output aria-label="PDF page number">
                {pageNumber} / {pageCount}
            </output>
            <Button
                type="button"
                theme="ghost-muted"
                size="big"
                aria-label="Next PDF page"
                disabled={pageNumber >= pageCount}
                onClick={nextPage}
            >
                <CaretRightIcon aria-hidden="true" size={20} />
            </Button>
        </nav>
    ) : null;
    const pageContent = error ? (
        <p className="p-6 text-center" role="alert">
            Could not render this PDF: {error}
        </p>
    ) : !document ? (
        <output className="block p-6 text-center" role="status">
            Opening PDF…
        </output>
    ) : pageRatio ? (
        <div className="relative mx-auto w-full max-w-5xl" style={pageStyle}>
            <PdfPage document={document} pageNumber={pageNumber} />
        </div>
    ) : (
        <output className="block p-6 text-center" role="status">
            Loading PDF page…
        </output>
    );
    return (
        <section
            className="flex h-full w-full flex-col bg-secondary-background text-foreground"
            aria-label={title}
            onPointerDown={stopLightboxNavigation}
        >
            <header className="flex min-h-12 shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-2">
                <span className="truncate text-sm" title={title}>
                    {title}
                </span>
                {pageNavigation}
            </header>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-4">{pageContent}</div>
        </section>
    );
}
