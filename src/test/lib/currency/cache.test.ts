import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCachedRates, setCachedRates, isCacheValid, clearCurrencyCache } from "../../../lib/currency/cache";
import { SettingsService } from "../../../store/settings";
import type { ExchangeRateData, CachedRates } from "../../../lib/currency/types";

vi.mock("../../../store/settings", () => ({
  SettingsService: {
    load: vi.fn(),
  },
}));

describe("currency/cache", () => {
  const mockData: ExchangeRateData = {
    base: "USD",
    date: "2026-02-16",
    rates: { EUR: 0.92, BRL: 5.0 },
    timestamp: Date.now(),
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    
    // Default settings mock
    vi.mocked(SettingsService.load).mockReturnValue({
      currency: {
        cacheDuration: 3600000, // 1 hour
      }
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should save and retrieve cached rates", () => {
    setCachedRates("USD", mockData);
    const cached = getCachedRates("USD");
    
    expect(cached).not.toBeNull();
    expect(cached?.data).toEqual(mockData);
  });

  it("should return null for expired cache", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    setCachedRates("USD", mockData);
    
    // Advance time past expiry (1 hour + 1 second)
    vi.setSystemTime(now + 3600001);
    
    const cached = getCachedRates("USD");
    expect(cached).toBeNull();
  });

  it("should invalidate cache across midnight due to date in key (Current Bug)", () => {
    vi.useFakeTimers();
    // Set time to 23:59:00
    const almostMidnight = new Date("2026-02-16T23:59:00Z").getTime();
    vi.setSystemTime(almostMidnight);

    setCachedRates("USD", mockData);
    expect(getCachedRates("USD")).not.toBeNull();

    // Move to 00:01:00 next day
    const afterMidnight = new Date("2026-02-17T00:01:00Z").getTime();
    vi.setSystemTime(afterMidnight);

    // This is expected to fail because of the date in buildCacheKey
    const cached = getCachedRates("USD");
    expect(cached).not.toBeNull(); 
  });

  it("should handle settings correctly", () => {
     setCachedRates("USD", mockData);
     expect(SettingsService.load).toHaveBeenCalled();
  });
});
