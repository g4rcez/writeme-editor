import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PdfMediaSlide } from "./pdf-media-slide";

const mocks = vi.hoisted(() => ({ loadPdfDocument: vi.fn() }));

vi.mock("@/lib/pdf-document", () => ({ loadPdfDocument: mocks.loadPdfDocument }));
vi.mock("./pdf-page", () => ({
    PdfPage: ({ pageNumber }: { pageNumber: number }) => <div>Rendered PDF page {pageNumber}</div>,
}));

describe("PDF media preview", () => {
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

    it("renders PDF pages and navigates within the document", async () => {
        render(<PdfMediaSlide src="blob:document.pdf" title="Document.pdf" />);

        expect(await screen.findByText("Rendered PDF page 1")).toBeInTheDocument();
        expect(screen.getByLabelText("PDF page number")).toHaveTextContent("1 / 2");

        fireEvent.click(screen.getByRole("button", { name: "Next PDF page" }));

        expect(await screen.findByText("Rendered PDF page 2")).toBeInTheDocument();
        expect(screen.getByLabelText("PDF page number")).toHaveTextContent("2 / 2");
        expect(screen.getByRole("button", { name: "Next PDF page" })).toBeDisabled();
    });
});
