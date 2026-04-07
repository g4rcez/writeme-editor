const RULE3_CALL_RE = /rule3\s*\(\s*([^)]+)\)/g;

const RULE3_INNER_RE =
  /^\s*(-?[a-zA-Z0-9_.]+)\s*\/\s*(-?[a-zA-Z0-9_.]+)\s*,\s*(-?[a-zA-Z0-9_.]+)\s*\/\s*(-?[a-zA-Z0-9_.]+)\s*$/;

const isNumeric = (token: string): boolean =>
  token !== "" && isFinite(Number(token)) && !isNaN(Number(token));

type Rule3Success = { ok: true; value: number; variable: string };
type Rule3Failure = { ok: false; error: string };
export type Rule3Result = Rule3Success | Rule3Failure;

export function solveRule3(inner: string): Rule3Result {
  const m = inner.match(RULE3_INNER_RE);
  if (!m) return { ok: false, error: "Invalid rule3 syntax" };

  const tokens = [m[1], m[2], m[3], m[4]];
  const numeric = tokens.map((t) => (isNumeric(t) ? Number(t) : null));
  const unknownIndices = numeric.reduce<number[]>(
    (acc, v, i) => (v === null ? [...acc, i] : acc),
    [],
  );

  if (unknownIndices.length === 0)
    return { ok: false, error: "No unknown variable" };
  if (unknownIndices.length > 1)
    return { ok: false, error: "Multiple unknowns" };

  const [a, b, c, d] = numeric as (number | null)[];
  const variable = tokens[unknownIndices[0]];

  // a/b = c/d  =>  a*d = b*c
  // solve for the unknown position
  let value: number;
  switch (unknownIndices[0]) {
    case 0: // a = (b * c) / d
      if (d === 0) return { ok: false, error: "Division by zero" };
      value = (b! * c!) / d!;
      break;
    case 1: // b = (a * d) / c
      if (c === 0) return { ok: false, error: "Division by zero" };
      value = (a! * d!) / c!;
      break;
    case 2: // c = (a * d) / b
      if (b === 0) return { ok: false, error: "Division by zero" };
      value = (a! * d!) / b!;
      break;
    case 3: // d = (b * c) / a
      if (a === 0) return { ok: false, error: "Division by zero" };
      value = (b! * c!) / a!;
      break;
    default:
      return { ok: false, error: "Unexpected error" };
  }

  return { ok: true, value, variable };
}

export function preprocessRule3(line: string): string {
  return line.replace(RULE3_CALL_RE, (_match, inner) => {
    const result = solveRule3(inner);
    if (!result.ok) return _match;
    return String(result.value);
  });
}
