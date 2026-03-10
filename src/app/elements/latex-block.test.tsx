import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LatexBlock } from "./latex-block";

// Mock MathJax globally
const mockTypesetPromise = vi.fn().mockResolvedValue(undefined);

describe("LatexBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).MathJax = {
      typesetPromise: mockTypesetPromise,
    };
  });

  it("renders the latex code in a display math block", () => {
    const code = "E = mc^2";
    render(<LatexBlock code={code} />);
    
    expect(screen.getByText(/E = mc\^2/)).toBeInTheDocument();
  });

  it("calls typesetPromise if MathJax is present", async () => {
    const code = "\\int_0^1 x dx";
    render(<LatexBlock code={code} />);

    expect(mockTypesetPromise).toHaveBeenCalled();
  });
});
