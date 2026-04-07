import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MathBlock } from "./math-block";
import { fetchExchangeRates } from "../../lib/currency";

// Mock the currency module
vi.mock("../../lib/currency", () => ({
  fetchExchangeRates: vi.fn(),
}));

describe("MathBlock", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should evaluate basic math expressions", async () => {
    (fetchExchangeRates as any).mockResolvedValue({
      base: "EUR",
      date: "2023-01-01",
      rates: { USD: 1.1 },
      timestamp: 1234567890,
    });

    render(<MathBlock code="1 + 1" />);
    
    expect(await screen.findByText("= 2")).toBeInTheDocument();
  });

  it("should evaluate currency conversion", async () => {
    (fetchExchangeRates as any).mockResolvedValue({
      base: "EUR",
      date: "2023-01-01",
      rates: { USD: 2.0 }, // 1 EUR = 2 USD => 1 USD = 0.5 EUR
      timestamp: 1234567890,
    });

    render(<MathBlock code="10 USD to EUR" />);

    // mathjs output for "10 USD to EUR" should be "5 EUR"
    expect(await screen.findByText("= 5 EUR")).toBeInTheDocument();
  });
});
