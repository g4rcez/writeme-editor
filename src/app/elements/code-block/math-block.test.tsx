import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MathBlock } from "./math-block";
import { fetchExchangeRates } from "../../../lib/currency";
import { __resetMathInstanceCache } from "solver";

vi.mock("../../../lib/currency", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/currency")>(
    "../../../lib/currency",
  );
  return {
    ...actual,
    fetchExchangeRates: vi.fn(),
  };
});

beforeEach(() => {
  __resetMathInstanceCache();
  localStorage.clear();
});

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

  it("renders a header line full-width with no result column", async () => {
    (fetchExchangeRates as any).mockResolvedValue(null);
    render(<MathBlock code="# Income" />);
    expect(await screen.findByText("Income")).toBeInTheDocument();
    expect(screen.queryByText(/^=/)).toBeNull();
  });

  it("renders a comment line with no result column", async () => {
    (fetchExchangeRates as any).mockResolvedValue(null);
    render(<MathBlock code="// just a note" />);
    expect(await screen.findByText("// just a note")).toBeInTheDocument();
    expect(screen.queryByText(/^=/)).toBeNull();
  });

  it("renders a variable line with name on left and value on right", async () => {
    (fetchExchangeRates as any).mockResolvedValue(null);
    render(<MathBlock code="x = 42" />);
    expect(await screen.findByText("x =")).toBeInTheDocument();
    expect(await screen.findByText("42")).toBeInTheDocument();
  });

  it("renders a label line with label on left and result on right", async () => {
    (fetchExchangeRates as any).mockResolvedValue(null);
    render(<MathBlock code="revenue: 100 + 50" />);
    expect(await screen.findByText("revenue")).toBeInTheDocument();
    expect(await screen.findByText("150")).toBeInTheDocument();
  });

  it("renders sum line after labels", async () => {
    (fetchExchangeRates as any).mockResolvedValue(null);
    render(<MathBlock code={"a: 10\nb: 20\nsum"} />);
    expect(await screen.findByText("sum")).toBeInTheDocument();
    expect(await screen.findByText("30")).toBeInTheDocument();
  });

  it("renders avg line after labels", async () => {
    (fetchExchangeRates as any).mockResolvedValue(null);
    render(<MathBlock code={"a: 10\nb: 30\navg"} />);
    expect(await screen.findByText("avg")).toBeInTheDocument();
    expect(await screen.findByText("20")).toBeInTheDocument();
  });

  it("renders error message for invalid expression in destructive color", async () => {
    (fetchExchangeRates as any).mockResolvedValue(null);
    render(<MathBlock code="undefinedVar + 1" />);
    await waitFor(() => {
      const el = document.querySelector(".text-destructive");
      expect(el).not.toBeNull();
    });
  });

  it("variable declared then used in a later expression", async () => {
    (fetchExchangeRates as any).mockResolvedValue(null);
    render(<MathBlock code={"rate = 2\nrate * 5"} />);
    expect(await screen.findByText("= 10")).toBeInTheDocument();
  });

  it("prev references last bare result", async () => {
    (fetchExchangeRates as any).mockResolvedValue(null);
    render(<MathBlock code={"100\nprev + 1"} />);
    expect(await screen.findByText("= 101")).toBeInTheDocument();
  });

  it("re-uses cached rates from localStorage on remount", async () => {
    const now = Date.now();
    localStorage.setItem(
      "WRITEME_CURRENCY_RATES_EUR",
      JSON.stringify({
        data: {
          base: "EUR",
          date: "2023-01-01",
          rates: { USD: 2.0 },
          timestamp: 1234567890,
        },
        fetchedAt: now,
        expiresAt: now + 60 * 60 * 1000,
      }),
    );

    render(<MathBlock code="10 USD to EUR" />);

    expect(await screen.findByText("= 5 EUR")).toBeInTheDocument();
    expect(vi.mocked(fetchExchangeRates)).not.toHaveBeenCalled();
  });
});

describe("MathBlock – date arithmetic", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["Date"],
      now: new Date("2025-01-15T12:00:00.000Z"),
    });
    vi.mocked(fetchExchangeRates).mockResolvedValue(null as any);
  });

  afterEach(() => vi.useRealTimers());

  it("renders 'today' as current ISO date", async () => {
    render(<MathBlock code="today" />);
    await waitFor(() => {
      expect(screen.getByText("today")).toBeInTheDocument();
      expect(screen.getByText("= 2025-01-15")).toBeInTheDocument();
    });
  });

  it("renders 'tomorrow'", async () => {
    render(<MathBlock code="tomorrow" />);
    await waitFor(() => {
      expect(screen.getByText("= 2025-01-16")).toBeInTheDocument();
    });
  });

  it("renders 'today + 17 days'", async () => {
    render(<MathBlock code="today + 17 days" />);
    await waitFor(() => {
      expect(screen.getByText("= 2025-02-01")).toBeInTheDocument();
    });
  });

  it("renders 'today + 1 decade'", async () => {
    render(<MathBlock code="today + 1 decade" />);
    await waitFor(() => {
      expect(screen.getByText("= 2035-01-15")).toBeInTheDocument();
    });
  });
});

describe("MathBlock – currency symbols and percentage", () => {
  beforeEach(() => {
    vi.mocked(fetchExchangeRates).mockResolvedValue({
      base: "EUR",
      date: "2023-01-01",
      rates: { USD: 1.1, JPY: 130, GBP: 0.85, BRL: 5.4 },
      timestamp: 1234567890,
    });
  });

  it("$100 + $50 evaluates to 150 USD", async () => {
    render(<MathBlock code="$100 + $50" />);
    await waitFor(() => {
      expect(screen.getByText("= 150 USD")).toBeInTheDocument();
    });
  });

  it("€100 to usd converts via registered units", async () => {
    render(<MathBlock code="€100 to usd" />);
    await waitFor(() => {
      // 100 EUR * (1.1 USD/EUR) = 110 USD
      expect(screen.getByText("= 110 USD")).toBeInTheDocument();
    });
  });

  it("12% of 321 in jpy evaluates as 12% of 321 JPY", async () => {
    render(<MathBlock code="12% of 321 in jpy" />);
    await waitFor(() => {
      expect(screen.getByText("= 38.52 JPY")).toBeInTheDocument();
    });
  });

  it("¥1000 renders using JPY unit", async () => {
    render(<MathBlock code="¥1000" />);
    await waitFor(() => {
      expect(screen.getByText("= 1000 JPY")).toBeInTheDocument();
    });
  });
});
