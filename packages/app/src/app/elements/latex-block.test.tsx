import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LatexBlock } from "./latex-block";

vi.mock("katex", () => ({
  default: {
    render: vi.fn(),
  },
}));

vi.mock("katex/dist/katex.min.css", () => ({}));

describe("LatexBlock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the container with aria-label", () => {
    render(<LatexBlock code="E = mc^2" />);
    expect(screen.getByLabelText("LaTeX Formula")).toBeInTheDocument();
  });

  it("calls katex.render with displayMode on mount", async () => {
    const katex = await import("katex");
    render(<LatexBlock code="x^2 + y^2 = z^2" />);
    expect(katex.default.render).toHaveBeenCalledWith(
      "x^2 + y^2 = z^2",
      expect.any(HTMLElement),
      expect.objectContaining({ displayMode: true }),
    );
  });
});
