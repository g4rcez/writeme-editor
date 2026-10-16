import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = new URL(
    "../../../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
).href;

export function loadPdfDocument(source: Uint8Array | string): PDFDocumentLoadingTask {
    const assets = new URL(`${import.meta.env.BASE_URL}pdfjs/`, window.location.href).href;
    return getDocument({
        ...(typeof source === "string" ? { url: source } : { data: source }),
        useSystemFonts: true,
        cMapUrl: `${assets}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${assets}standard_fonts/`,
        wasmUrl: `${assets}wasm/`,
    });
}
