import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Graphviz } from "./graphviz";

const NS = "http://www.w3.org/2000/svg";

const mockRenderSVGElement = vi.fn((dot: string) => {
  if (dot.includes("invalid")) throw new Error("syntax error in DOT source");
  const svg = document.createElementNS(NS, "svg");
  const title = document.createElementNS(NS, "title");
  title.textContent = "test title";
  svg.appendChild(title);
  return svg;
});

vi.mock("@viz-js/viz", () => ({
  instance: vi.fn(() =>
    Promise.resolve({
      renderSVGElement: (dot: string) => mockRenderSVGElement(dot),
    }),
  ),
}));

describe("Graphviz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.className = "";
  });

  it("renders SVG into the container for valid DOT", async () => {
    render(<Graphviz dot="digraph G { a -> b }" />);
    await waitFor(() => {
      expect(document.querySelector("svg")).toBeInTheDocument();
    });
  });

  it("injects dark theme attributes when in dark mode", async () => {
    document.documentElement.className = "dark";
    render(<Graphviz dot="digraph G { a -> b }" />);

    await waitFor(() => {
      expect(mockRenderSVGElement).toHaveBeenCalled();
      const dotPassed = mockRenderSVGElement.mock.calls[0][0];
      expect(dotPassed).toContain('bgcolor="transparent"');
      expect(dotPassed).toContain('fontname="IBM Plex Sans"');
      expect(dotPassed).toContain("#f3f4f7"); // Dark theme foreground (approximate)
    });
  });

  it("removes title elements from the rendered SVG", async () => {
    render(<Graphviz dot="digraph G { a -> b }" />);
    await waitFor(() => {
      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg?.querySelector("title")).not.toBeInTheDocument();
    });
  });

  it("shows error message when renderSVGElement throws", async () => {
    render(<Graphviz dot="invalid" />);
    await waitFor(() => {
      expect(
        screen.getByText(/syntax error in DOT source/i),
      ).toBeInTheDocument();
    });
  });

  it("shows loading indicator before async instance resolves", async () => {
    const { instance } = await import("@viz-js/viz");
    vi.mocked(instance).mockReturnValueOnce(new Promise(() => {}));

    render(<Graphviz dot="digraph G { a -> b }" />);
    expect(screen.getByText(/rendering/i)).toBeInTheDocument();
  });
});
