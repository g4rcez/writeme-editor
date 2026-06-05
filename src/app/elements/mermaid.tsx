import mermaid from "mermaid";
import { useEffect, useRef } from "react";
import { useThemeChange } from "@/app/hooks/use-theme-change";
import { createMermaidThemeVariables } from "./mermaid-theme";

mermaid.registerIconPacks([
  {
    name: "logos",
    loader: () => import("@iconify-json/logos").then((module) => module.icons),
  },
]);

const getMermaidConfig = (): Parameters<typeof mermaid.initialize>[0] => ({
  theme: "base",
  startOnLoad: false,
  markdownAutoWrap: true,
  securityLevel: "loose",
  arrowMarkerAbsolute: true,
  themeVariables: createMermaidThemeVariables(),
});

export const Mermaid = (props: { chart: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const renderChart = async () => {
    const container = containerRef.current;
    if (!container || !props.chart) return;
    container.textContent = props.chart;
    container.removeAttribute("data-processed");
    await mermaid.run({ nodes: [container] });
  };

  useEffect(() => {
    mermaid.initialize(getMermaidConfig());
    renderChart();
  }, []);

  useThemeChange(() => {
    mermaid.initialize(getMermaidConfig());
    renderChart();
  });

  useEffect(() => {
    renderChart();
  }, [props.chart]);

  return (
    <div ref={containerRef} className="mermaid">
      {props.chart}
    </div>
  );
};
