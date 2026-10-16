import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MediaPreview } from "./media-preview";

const mocks = vi.hoisted(() => ({
    closeMediaPreview: vi.fn(),
    loadPdfDocument: vi.fn(),
    state: {
        mediaPreview: {
            open: true,
            sources: [{ src: "blob:document.pdf", type: "pdf", title: "Document.pdf" }],
            index: 0,
        },
    },
}));

vi.mock("@/store/ui.store", () => ({
    uiDispatch: { closeMediaPreview: mocks.closeMediaPreview },
    useUIStore: () => [mocks.state],
}));
vi.mock("@/lib/pdf-document", () => ({ loadPdfDocument: mocks.loadPdfDocument }));
vi.mock("./pdf-page", () => ({
    PdfPage: ({ pageNumber }: { pageNumber: number }) => <div>Rendered PDF page {pageNumber}</div>,
}));

describe("PDF media lightbox", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.loadPdfDocument.mockReturnValue({
            promise: Promise.resolve({
                numPages: 2,
                getPage: vi.fn().mockResolvedValue({ getViewport: () => ({ width: 100, height: 140 }) }),
            }),
            destroy: vi.fn(),
        });
    });

    it("keeps the lightbox open while clicking through PDF pages", async () => {
        render(<MediaPreview />);
        const activeSlide = (): HTMLElement => {
            const slide = document.querySelector<HTMLElement>(".yarl__slide_current");
            expect(slide).not.toBeNull();
            return slide!;
        };

        expect(await within(activeSlide()).findByText("Rendered PDF page 1")).toBeInTheDocument();
        const nextPage = within(activeSlide()).getByRole("button", { name: "Next PDF page" });
        fireEvent.pointerDown(nextPage, { pointerId: 1 });
        fireEvent.pointerUp(nextPage, { pointerId: 1 });
        fireEvent.click(nextPage);

        await waitFor(() => expect(within(activeSlide()).getByLabelText("PDF page number")).toHaveTextContent("2 / 2"));
        expect(screen.getByRole("dialog", { name: "Lightbox" })).toBeInTheDocument();
    });
});
