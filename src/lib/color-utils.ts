const f = (n: number, hue: number, alpha: number, lFraction: number) => {
  const k = (n + hue / 30) % 12;
  const color =
    lFraction - alpha * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  return Math.round(255 * color)
    .toString(16)
    .padStart(2, "0");
};

export const parseHslaToHex = (hslaString: string) => {
  const sep = hslaString.includes(",") ? "," : " ";
  const parts = hslaString
    .split(new RegExp(`hsla?\\(|\\)|${sep}|/`, "g"))
    .filter(Boolean);
  if (parts.length < 3) return "#000000";
  const hue = parseFloat(parts[0]!);
  const saturation = parseFloat(parts[1]!);
  const lightness = parseFloat(parts[2]!);
  const sFraction = saturation / 100;
  const lFraction = lightness / 100;
  const alpha = sFraction * Math.min(lFraction, 1 - lFraction);
  const r = f(0, hue, alpha, lFraction);
  const g = f(8, hue, alpha, lFraction);
  const b = f(4, hue, alpha, lFraction);
  return `#${r}${g}${b}`.toLowerCase();
};
