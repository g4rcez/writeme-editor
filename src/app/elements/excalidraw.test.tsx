import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ExcalidrawCode } from "./excalidraw";
import * as ExcalidrawPkg from "@excalidraw/excalidraw";

// Mock the external library
vi.mock("@excalidraw/excalidraw", () => ({
  Excalidraw: ({ onChange, initialData }: any) => (
    <div data-testid="excalidraw-mock">
      <button onClick={() => onChange([{ type: "rectangle", id: "1" }])}>
        Change
      </button>
      <span>Elements: {JSON.stringify(initialData?.elements)}</span>
    </div>
  ),
  restoreElements: (elements: any) => elements,
}));

describe("ExcalidrawCode", () => {
  it("initializes with provided code", async () => {
    const code = JSON.stringify([{ type: "rectangle", id: "initial" }]);
    render(<ExcalidrawCode code={code} />);

    await waitFor(() => {
      expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument();
    });
    
    expect(screen.getByText(/initial/)).toBeInTheDocument();
  });

  it("handles empty/invalid code gracefully", async () => {
     // Mock console.error to avoid noise
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    
    render(<ExcalidrawCode code="invalid-json" />);
    
    await waitFor(() => {
        expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it("propagates changes via onChange", async () => {
    const onChange = vi.fn();
    const code = JSON.stringify([]);
    render(<ExcalidrawCode code={code} onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByTestId("excalidraw-mock")).toBeInTheDocument();
    });

    // Simulate change
    screen.getByText("Change").click();

    expect(onChange).toHaveBeenCalledWith(JSON.stringify([{ type: "rectangle", id: "1" }]));
  });
});
