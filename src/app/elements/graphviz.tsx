import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { MagnifyingGlassPlusIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlassPlus";
import { MagnifyingGlassMinusIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlassMinus";
import { ArrowsCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowsCounterClockwise";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { MinusIcon } from "@phosphor-icons/react/dist/csr/Minus";
import { type Viz, instance } from "@viz-js/viz";
import { useEffect, useRef, useState, useCallback } from "react";
import { darkTheme } from "../styles/dark";
import { parseHslaToHex } from "@/lib/editor-utils";
import { motion, AnimatePresence } from "motion/react";
import { Button, Tooltip, css } from "@g4rcez/components";

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

const THEMES = {
  dark: {
    foreground: parseHslaToHex(darkTheme.colors.foreground),
    border: parseHslaToHex(darkTheme.colors.floating.border),
    nodeBg: parseHslaToHex(darkTheme.colors.floating.background),
  },
  light: {
    foreground: "#1b222c",
    border: "#d1d5db",
    nodeBg: "#ffffff",
  },
};

const injectTheme = (dot: string, isDark: boolean) => {
  const colors = isDark ? THEMES.dark : THEMES.light;
  const themeAttributes = `
    graph [nodesep=0.1, ranksep=0.1, margin=0, pad=0.02, fontsize=8, center=true, bgcolor="transparent", fontname="IBM Plex Sans", fontcolor="${colors.foreground}", color="${colors.border}"];
    node [fontsize=8, fontname="IBM Plex Sans", fontcolor="${colors.foreground}", color="${colors.border}", fillcolor="${colors.nodeBg}", style="filled"];
    edge [fontsize=8, fontname="IBM Plex Sans", fontcolor="${colors.foreground}", color="${colors.border}"];
  `;
  const firstBrace = dot.indexOf("{");
  if (firstBrace !== -1) {
    return (
      dot.slice(0, firstBrace + 1) + themeAttributes + dot.slice(firstBrace + 1)
    );
  }
  return dot;
};

const processSVG = (svg: SVGSVGElement) => {
  svg.querySelectorAll("title").forEach((t) => t.remove());
  svg.querySelectorAll("desc").forEach((d) => d.remove());

  // Remove comments
  const iterator = document.createNodeIterator(svg, NodeFilter.SHOW_COMMENT);
  let comment;
  while ((comment = iterator.nextNode())) {
    comment.parentElement?.removeChild(comment);
  }

  svg.style.width = "100%";
  svg.style.height = "auto";
  svg.style.display = "block";
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  return svg;
};

export const Graphviz = ({ dot }: { dot: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isZoomEnabled, setIsZoomEnabled] = useState(true);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const render = useCallback(
    async (code: string) => {
      const container = containerRef.current;
      if (!container || !code) return;
      setLoading(true);
      setError(null);
      try {
        const viz = await getViz();
        const isDark = document.documentElement.classList.contains("dark");
        const themedDot = injectTheme(code, isDark);
        const svg = processSVG(
          viz.renderSVGElement(themedDot, {
            reduce: true,
          }),
        );
        container.innerHTML = "";
        container.appendChild(svg);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [containerRef],
  );

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
  }, [dot, render]);

  const handleWheel = (e: React.WheelEvent) => {
    if (!isZoomEnabled) return;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.min(Math.max(s * delta, 0.1), 10));
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  if (error) {
    return (
      <div className="p-2 font-mono text-sm text-red-600 bg-red-50 rounded dark:text-red-400 dark:bg-red-950">
        {error}
      </div>
    );
  }

  return (
    <div className="relative group overscroll-contain graphviz-block">
      <AnimatePresence>
        {!loading && (
          <motion.div
            exit={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: -10 }}
            className="flex absolute top-2 overscroll-contain right-2 z-10 gap-1 p-1 opacity-0 rounded-md border shadow-sm transition-opacity bg-background/80 backdrop-blur-sm border-border group-hover:opacity-100"
          >
            <Tooltip
              title={
                <Button
                  size="small"
                  theme={isZoomEnabled ? "primary" : "muted"}
                  onClick={() => {
                    const nextValue = !isZoomEnabled;
                    setIsZoomEnabled(nextValue);
                    if (isZoomEnabled) resetZoom();
                  }}
                >
                  {isZoomEnabled ? (
                    <MagnifyingGlassMinusIcon size={14} />
                  ) : (
                    <MagnifyingGlassPlusIcon size={14} />
                  )}
                </Button>
              }
            >
              {isZoomEnabled ? "Disable Zoom" : "Enable Zoom"}
            </Tooltip>
            {isZoomEnabled && (
              <>
                <Tooltip
                  title={
                    <Button
                      size="small"
                      theme="muted"
                      onClick={() => setScale((s) => Math.min(s * 1.2, 10))}
                    >
                      <PlusIcon size={14} />
                    </Button>
                  }
                >
                  Zoom in
                </Tooltip>
                <Tooltip
                  title={
                    <Button
                      size="small"
                      theme="muted"
                      onClick={() => setScale((s) => Math.max(s / 1.2, 0.1))}
                    >
                      <MinusIcon size={14} />
                    </Button>
                  }
                >
                  Zoom out
                </Tooltip>
                <Tooltip
                  title={
                    <Button size="small" theme="muted" onClick={resetZoom}>
                      <ArrowsCounterClockwiseIcon size={14} />
                    </Button>
                  }
                >
                  Reset zoom
                </Tooltip>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="flex gap-2 items-center p-2 text-sm text-muted-foreground">
          <CircleNotchIcon className="animate-spin" size={16} />
          <span>Rendering…</span>
        </div>
      )}

      <div
        onWheel={handleWheel}
        className={css(
          "overflow-hidden rounded-lg border border-transparent transition-colors",
          isZoomEnabled && "cursor-move border-border bg-card/10 h-[400px]",
        )}
      >
        <motion.div
          drag={isZoomEnabled}
          dragConstraints={{
            left: -2000,
            right: 2000,
            top: -2000,
            bottom: 2000,
          }}
          dragElastic={0.1}
          animate={{
            scale,
            x: position.x,
            y: position.y,
          }}
          onDragEnd={(_, info) => {
            setPosition((p) => ({
              x: p.x + info.offset.x,
              y: p.y + info.offset.y,
            }));
          }}
          className={css(
            "flex justify-center items-center w-full h-full",
            isZoomEnabled ? "p-8" : "p-0",
          )}
        >
          <div ref={containerRef} className="w-full h-full" />
        </motion.div>
      </div>
    </div>
  );
};
