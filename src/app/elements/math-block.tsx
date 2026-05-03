import { useEffect, useMemo, useState } from "react";
import {
  fetchExchangeRates,
  getCachedRates,
  setCachedRates,
  type ExchangeRateData,
} from "@/lib/currency";
import { evaluateCode, type EvaluatedResult } from "@/lib/math-block";

const ResultCell = ({
  result,
  prefix = "",
  bold,
}: {
  result: EvaluatedResult;
  prefix?: string;
  bold?: boolean;
}) => {
  if (!result.ok) {
    return <span className="text-destructive text-xs">{result.message}</span>;
  }
  return (
    <span className={bold ? "text-primary font-bold" : "text-primary"}>
      {prefix}
      {result.value}
    </span>
  );
};

const EmptyLine = () => <li className="h-6 list-none" />;

const HeaderLine = ({ text }: { text: string }) => (
  <li className="list-none items-center font-mono pt-2 text-xs uppercase tracking-wider text-muted-foreground">
    {text}
  </li>
);

const CommentLine = ({ text }: { text: string }) => (
  <li className="list-none items-center font-mono italic opacity-50 text-muted-foreground">
    {text}
  </li>
);

const VariableLine = ({
  name,
  result,
}: {
  name: string;
  result: EvaluatedResult;
}) => (
  <li className="flex gap-2 font-mono list-none items-center text-muted-foreground">
    <span className="opacity-70">{name} =</span>
    <ResultCell result={result} />
  </li>
);

const LabelLine = ({
  label,
  result,
}: {
  label: string;
  result: EvaluatedResult;
}) => (
  <li className="flex items-center gap-2 font-mono list-none">
    <span>{label}</span>
    <ResultCell result={result} />
  </li>
);

const BareLine = ({
  raw,
  result,
}: {
  raw: string;
  result: EvaluatedResult;
}) => (
  <li className="flex items-center gap-2 font-mono list-none">
    <span>{raw}</span>
    <ResultCell result={result} prefix="= " />
  </li>
);

const TotalLine = ({
  kind,
  result,
}: {
  kind: "sum" | "avg";
  result: EvaluatedResult;
}) => (
  <li className="flex gap-2 items-center font-mono list-none border-t border-card-border pt-1 mt-1">
    <span className="text-xs uppercase tracking-wider text-muted-foreground">
      {kind}
    </span>
    <ResultCell result={result} bold />
  </li>
);

async function loadExchangeRates(base: string): Promise<ExchangeRateData> {
  const cached = getCachedRates(base);
  if (cached) return cached.data;
  const data = await fetchExchangeRates(base);
  setCachedRates(base, data);
  return data;
}

export const MathBlock = (props: { code: string }) => {
  const [ratesData, setRatesData] = useState<ExchangeRateData | null>(
    () => getCachedRates("EUR")?.data ?? null,
  );

  useEffect(() => {
    loadExchangeRates("EUR")
      .then(setRatesData)
      .catch((e) => console.error("Failed to fetch rates for MathBlock", e));
  }, []);

  const evaluated = useMemo(
    () => evaluateCode(props.code, ratesData),
    [props.code, ratesData],
  );

  return (
    <div className="pt-4 font-mono border-t border-card-border">
      <ul className="list-none list-outside mx-0 flex flex-col gap-0">
        {evaluated.map((line, i) => {
          switch (line.kind) {
            case "empty":
              return <EmptyLine key={i} />;
            case "header":
              return <HeaderLine key={i} text={line.text} />;
            case "comment":
              return <CommentLine key={i} text={line.text} />;
            case "variable":
              return (
                <VariableLine key={i} name={line.name} result={line.result} />
              );
            case "label":
              return (
                <LabelLine key={i} label={line.label} result={line.result} />
              );
            case "bare":
              return <BareLine key={i} raw={line.raw} result={line.result} />;
            case "sum":
            case "avg":
              return (
                <TotalLine key={i} kind={line.kind} result={line.result} />
              );
          }
        })}
      </ul>
    </div>
  );
};
