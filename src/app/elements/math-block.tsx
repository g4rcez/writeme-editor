import { parser as mathParser, format } from "mathjs";
import { useId, useMemo } from "react";

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
  const expressions = useMemo(() => {
    try {
      const lines = props.code.split("\n");
      const parser = mathParser();
      return lines.map((x) => {
        const expr = x.trim();
        if (x.startsWith("//")) {
          return [];
        }
        if (expr === "") return [];
        const translated = expressionImprovements(expr);
        const result = parser.evaluate(translated);
        return [
          x,
          format(result, {
            precision: 5,
            notation: "auto",
            fraction: "ratio",
          }),
        ];
      });
    } catch (e) {
      return [];
    }
  }, [props.code]);

  return (
    <ul className="list-none !list-outside !mx-0 flex flex-col gap-1">
      {expressions.map(([expr, value], index) =>
        !expr ? null : (
          <li
            key={`${id}-${expr}-${index}`}
            className="flex gap-4 font-mono list-none"
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
    <div className="px-4 pb-4">
      <div className="pt-4 font-mono border-t border-gray-200 dark:border-gray-700">
        <MathEvaluate code={props.code} />
      </div>
    </div>
  );
};
