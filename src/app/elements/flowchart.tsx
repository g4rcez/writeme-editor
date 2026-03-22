import { useEffect, useRef, useState } from "react";
import { useThemeChange } from "@/app/hooks/use-theme-change";
import flowchart from "flowchart.js";
import Raphael from "raphael";
import { darkTheme } from "../styles/dark";
import { lightTheme } from "../styles/light";
import { parseHslaToHex } from "@/lib/color-utils";

if (typeof window !== "undefined") {
  (window as any).Raphael = Raphael;
}

const getFlowchartOptions = (isDark: boolean) => {
  const theme = isDark ? darkTheme : lightTheme;
  const colors = {
    foreground: parseHslaToHex(theme.colors.foreground),
    border: parseHslaToHex(theme.colors.border),
    nodeBg: parseHslaToHex(theme.colors.card.background),
    primary: parseHslaToHex(theme.colors.primary.DEFAULT),
    primaryText: parseHslaToHex(theme.colors.primary.foreground),
    success: parseHslaToHex(theme.colors.success.DEFAULT),
    danger: parseHslaToHex(theme.colors.danger.DEFAULT),
    warn: parseHslaToHex(theme.colors.warn.DEFAULT),
  };

  return {
    "line-width": 2,
    "line-length": 50,
    "text-margin": 12,
    "font-size": 14,
    "font-family": "IBM Plex Sans, sans-serif",
    "font-color": colors.foreground,
    "line-color": colors.foreground,
    "element-color": colors.foreground,
    fill: colors.nodeBg,
    "yes-text": "yes",
    "no-text": "no",
    "arrow-end": "block",
    scale: 1,
    symbols: {
      start: {
        "font-color": colors.primary,
        "element-color": colors.primary,
        fill: colors.nodeBg,
        "font-weight": "bold",
      },
      end: {
        "font-color": colors.foreground,
        "element-color": colors.border,
        fill: colors.border,
      },
      condition: {
        "font-color": colors.foreground,
        "element-color": colors.border,
        fill: colors.nodeBg,
      },
    },
    flowstate: {
      past: { fill: "#999999", "font-color": "white" },
      current: {
        fill: colors.primary,
        "font-color": colors.primaryText,
        "font-weight": "bold",
      },
      future: { fill: colors.nodeBg, "element-color": colors.primary },
      request: { fill: colors.warn, "font-color": "white" },
      invalid: { fill: "#444444", "font-color": "white" },
      approved: {
        fill: colors.success,
        "font-size": 12,
        "yes-text": "APPROVED",
        "no-text": "n/a",
        "font-color": "white",
      },
      rejected: {
        fill: colors.danger,
        "font-size": 12,
        "yes-text": "n/a",
        "no-text": "REJECTED",
        "font-color": "white",
      },
    },
  };
};

export const Flowchart = ({ code }: { code: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const render = () => {
    const container = containerRef.current;
    if (!container || !code) return;

    container.innerHTML = "";
    setError(null);

    try {
      const isDark = document.documentElement.classList.contains("dark");
      const options = getFlowchartOptions(isDark);
      const diagram = flowchart.parse(code);
      diagram.drawSVG(container, options);

      // Cleanup SVG: make it responsive
      const svg = container.querySelector("svg");
      if (svg) {
        svg.style.width = "100%";
        svg.style.height = "auto";
        svg.style.maxWidth = "100%";
        svg.style.display = "block";
        svg.removeAttribute("width");
        svg.removeAttribute("height");
      }
    } catch (err) {
      console.error("Flowchart rendering error:", err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    render();
  }, [code]);

  useThemeChange(() => render());

  if (error) {
    return (
      <div className="p-2 font-mono text-sm text-red-600 bg-red-50 rounded dark:text-red-400 dark:bg-red-950">
        {error}
      </div>
    );
  }

  return <div ref={containerRef} className="flowchart-container" />;
};
