import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Graphviz } from "./graphviz";

const NS = "http://www.w3.org/2000/svg";

vi.mock("@viz-js/viz", () => ({
  instance: vi.fn(() =>
    Promise.resolve({
      renderSVGElement: (dot: string) => {
        if (dot === "invalid") throw new Error("syntax error in DOT source");
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("data-testid", "graphviz-svg");
        return svg;
      },
    }),
  ),
}));

describe("Graphviz", () => {
  it("renders SVG into the container for valid DOT", async () => {
    render(<Graphviz dot="digraph G { a -> b }" />);
    await waitFor(() => {
      expect(document.querySelector("svg")).toBeInTheDocument();
    });
  });

  it("shows error message when renderSVGElement throws", async () => {
    render(<Graphviz dot="invalid" />);
    await waitFor(() => {
      expect(screen.getByText(/syntax error in DOT source/i)).toBeInTheDocument();
    });
  });

  it("shows loading indicator before async instance resolves", async () => {
    const { instance } = await import("@viz-js/viz");
    vi.mocked(instance).mockReturnValueOnce(new Promise(() => {}));

    render(<Graphviz dot="digraph G { a -> b }" />);
    expect(screen.getByText(/rendering/i)).toBeInTheDocument();
  });
});
