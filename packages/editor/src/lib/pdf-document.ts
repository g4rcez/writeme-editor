import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = new URL(
    "../../../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
).href;

export function loadPdfDocument(data: Uint8Array): ReturnType<typeof getDocument> {
    const assets = new URL(`${import.meta.env.BASE_URL}pdfjs/`, window.location.href).href;
    return getDocument({
        data,
        useSystemFonts: true,
        cMapUrl: `${assets}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${assets}standard_fonts/`,
        wasmUrl: `${assets}wasm/`,
    });
}
