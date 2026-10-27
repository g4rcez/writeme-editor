import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ExcalidrawCode } from "./excalidraw";

vi.mock("@excalidraw/excalidraw", () => ({
    Excalidraw: ({ onChange, initialData }: any) => (
        <div data-testid="excalidraw-mock">
            <button onClick={() => onChange([{ type: "rectangle", id: "1" }])}>Change</button>
            <button onClick={() => onChange(initialData.elements)}>Unchanged</button>
            <button onClick={() => onChange([])}>Clear</button>
            <span>Elements: {JSON.stringify(initialData?.elements)}</span>
        </div>
    ),
    restoreElements: (elements: any) => elements,
}));

// writes back to the editor are debounced, so assertions wait for them
const settled = (ms = 700) => new Promise((resolve) => setTimeout(resolve, ms));

describe("ExcalidrawCode", () => {
    it("initializes with provided code", async () => {
        const code = JSON.stringify([{ type: "rectangle", id: "initial" }]);
        render(<ExcalidrawCode code={code} autoDelete={() => {}} />);

        await waitFor(() => {
            expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument();
        });

        expect(screen.getByText(/initial/)).toBeInTheDocument();
    });

    it("handles empty/invalid code gracefully", async () => {
        // Mock console.error to avoid noise
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        render(<ExcalidrawCode code="invalid-json" autoDelete={() => {}} />);

        await waitFor(() => {
            expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument();
        });

        consoleSpy.mockRestore();
    });

    it("propagates changes via onChange", async () => {
        const onChange = vi.fn();
        const code = JSON.stringify([]);
        render(<ExcalidrawCode code={code} onChange={onChange} autoDelete={() => {}} />);
        await waitFor(() => {
            expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument();
        });
        screen.getByText("Change").click();
        expect(onChange).not.toHaveBeenCalled();
        await waitFor(() => expect(onChange).toHaveBeenCalledWith(JSON.stringify([{ type: "rectangle", id: "1" }])));
    });

    it("writes a burst of changes back once", async () => {
        const onChange = vi.fn();
        render(<ExcalidrawCode code="[]" onChange={onChange} autoDelete={() => {}} />);
        await waitFor(() => expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument());
        screen.getByText("Change").click();
        screen.getByText("Clear").click();
        screen.getByText("Change").click();
        await settled();
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("flushes a pending change when the drawing is closed", async () => {
        const onChange = vi.fn();
        const { unmount } = render(<ExcalidrawCode code="[]" onChange={onChange} autoDelete={() => {}} />);
        await waitFor(() => expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument());
        screen.getByText("Change").click();
        unmount();
        expect(onChange).toHaveBeenCalledWith(JSON.stringify([{ type: "rectangle", id: "1" }]));
    });

    it("does not write unchanged scenes back into the editor", async () => {
        const onChange = vi.fn();
        render(
            <ExcalidrawCode code='[{"type":"rectangle","id":"initial"}]' onChange={onChange} autoDelete={() => {}} />,
        );
        await waitFor(() => expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument());
        screen.getByText("Unchanged").click();
        await settled();
        expect(onChange).not.toHaveBeenCalled();
        screen.getByText("Change").click();
        screen.getByText("Change").click();
        await settled();
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("uses the current callback after a parent update", async () => {
        const original = vi.fn();
        const replacement = vi.fn();
        const autoDelete = () => {};
        const { rerender } = render(<ExcalidrawCode code="[]" onChange={original} autoDelete={autoDelete} />);
        rerender(<ExcalidrawCode code="[]" onChange={replacement} autoDelete={autoDelete} />);
        await waitFor(() => expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument());
        screen.getByText("Change").click();
        await settled();
        expect(original).not.toHaveBeenCalled();
        expect(replacement).toHaveBeenCalledExactlyOnceWith(JSON.stringify([{ type: "rectangle", id: "1" }]));
    });

    it("persists deleting the last element", async () => {
        const onChange = vi.fn();
        render(
            <ExcalidrawCode code='[{"type":"rectangle","id":"initial"}]' onChange={onChange} autoDelete={() => {}} />,
        );
        await waitFor(() => expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument());
        screen.getByText("Clear").click();
        await waitFor(() => expect(onChange).toHaveBeenCalledWith("[]"));
    });
});
