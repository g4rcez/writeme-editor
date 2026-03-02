import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { type Viz, instance } from "@viz-js/viz";
import { useEffect, useRef, useState } from "react";

let vizInstance: Viz | null = null;
let vizPromise: Promise<Viz> | null = null;

const getViz = (): Promise<Viz> => {
  if (vizInstance) return Promise.resolve(vizInstance);
  if (vizPromise) return vizPromise;
  vizPromise = instance().then((viz) => {
    vizInstance = viz;
    return viz;
  });
  return vizPromise;
};

export const Graphviz = ({ dot }: { dot: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const render = async (code: string) => {
    const container = containerRef.current;
    if (!container || !code) return;
    setLoading(true);
    setError(null);
    try {
      const viz = await getViz();
      const svg = viz.renderSVGElement(code, {
        reduce: true,
      });
      svg.setAttribute("width", "fit-content");
      svg.removeAttribute("height");
      container.innerHTML = "";
      container.appendChild(svg);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    render(dot);
    const observer = new MutationObserver(() => {
      render(dot);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    render(dot);
  }, [dot]);

  if (error) {
    return (
      <div className="p-2 font-mono text-sm text-red-600 bg-red-50 rounded dark:text-red-400 dark:bg-red-950">
        {error}
      </div>
    );
  }

  return (
    <div className="relative graphviz-block">
      {loading && (
        <div className="flex gap-2 items-center p-2 text-sm text-muted-foreground">
          <CircleNotchIcon className="animate-spin" size={16} />
          <span>Rendering…</span>
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
};
