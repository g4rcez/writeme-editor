import { all, create } from "mathjs";
import type { ExchangeRateData } from "@/lib/currency";

export type MathInstance = ReturnType<typeof create>;

type Props = {
  emCss: number;
};

export function createMathInstance(props: Props): MathInstance {
  const math = create(all!);
  math.createUnit("px");
  math.createUnit("pt", "1.3333 px", { override: true });
  math.createUnit("em", "16 px");
  math.createUnit("em", `${props.emCss} px`, { override: true });
  return math;
}

export function reconfigureEm(math: MathInstance, emPx: number) {
  try {
    math.createUnit("em", `${emPx} px`, { override: true });
  } catch {}
  return math;
}

function registerCurrencyUnits(
  math: MathInstance,
  ratesData: ExchangeRateData,
): void {
  try {
    math.createUnit("EUR");
    Object.entries(ratesData.rates).forEach(([code, rate]) => {
      if (code !== "EUR") {
        try {
          math.createUnit(code, math.unit(1 / rate, "EUR"));
        } catch {}
      }
    });
  } catch {}
}

let cached: MathInstance | null = null;
let cachedTs: number | null = null;

export function getMathInstance(
  emCss: number,
  ratesData: ExchangeRateData | null,
): MathInstance {
  const ts = ratesData?.timestamp ?? null;
  if (cached === null || cachedTs !== ts) {
    cached = createMathInstance({ emCss });
    cachedTs = ts;
    if (ratesData) registerCurrencyUnits(cached, ratesData);
    return cached;
  }
  reconfigureEm(cached, emCss);
  return cached;
}

export function __resetMathInstanceCache(): void {
  cached = null;
  cachedTs = null;
}
