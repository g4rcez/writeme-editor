import { create, all, format } from "mathjs";
import { useId, useMemo, useState, useEffect } from "react";
import { fetchExchangeRates, type ExchangeRateData } from "../../lib/currency";
import { Dates } from "../../lib/dates";
import { preprocessRule3 } from "@/lib/rule-of-three";

const expressionImprovements = (expr: string): string =>
  expr
    .replace(/^\/\/.*/, "")
    .replace(/\*\*/g, "^")
    .replace(/(fatorial)/g, "! ")
    .replace(/([\d., ]+)" /g, "$1inches ")
    .replace(/([\d., ]+)(C|°C|°c) /g, "$1celsius ")
    .replace(/([\d., ]+)(F|°F|°f) /g, "$1fahrenheit ")
    .replace(/([\d., ]+)(K|°K|°k) /g, "$1kelvin ")
    .replace(/([\d.,]+) ?percent of /g, "$1% ")
    .replace(/to (F|°F|°f)/g, "to fahrenheit ")
    .replace(/to (K|°K|°k)/g, "to kelvin ")
    .replace(/to (C|°C|°c)/g, "to celsius ");

const MathEvaluate = (props: { code: string }) => {
  const id = useId();
  const [ratesData, setRatesData] = useState<ExchangeRateData | null>(null);

  useEffect(() => {
    fetchExchangeRates("EUR")
      .then(setRatesData)
      .catch((e) => console.error("Failed to fetch rates for MathBlock", e));
  }, []);

  const expressions = useMemo(() => {
    const math = create(all);
    if (ratesData) {
      try {
        math.createUnit("EUR");
      } catch (e) {}
      Object.entries(ratesData.rates).forEach(([code, rate]) => {
        if (code !== "EUR") {
          try {
            math.createUnit(code, math.unit(1 / rate, "EUR"));
          } catch (e) {}
        }
      });
    }
    const lines = props.code.split("\n");
    const parser = math.parser();
    return lines.map((x) => {
      const expr = x.trim();
      if (x.startsWith("//") || expr === "") {
        return [];
      }
      try {
        const timezoneResult = Dates.evaluateTimezone(expr);
        if (timezoneResult) {
          return [x, timezoneResult];
        }
      } catch (e) {}
      try {
        const translated = expressionImprovements(preprocessRule3(expr));
        const result = parser.evaluate(translated);
        return [
          x,
          format(result, {
            precision: 5,
            notation: "auto",
            fraction: "ratio",
          }),
        ];
      } catch (e) {
        return [];
      }
    });
  }, [props.code, ratesData]);

  return (
    <ul className="list-none !list-outside !mx-0 flex flex-col gap-0">
      {expressions.map(([expr, value], index) =>
        !expr ? null : (
          <li
            key={`${id}-${expr}-${index}`}
            className="flex gap-2 font-mono list-none"
          >
            {expr}
            <span className="text-primary">= {value}</span>
          </li>
        ),
      )}
    </ul>
  );
};

export const MathBlock = (props: { code: string }) => {
  return (
    <div className="pt-4 font-mono border-t border-card-border">
      <MathEvaluate code={props.code} />
    </div>
  );
};
