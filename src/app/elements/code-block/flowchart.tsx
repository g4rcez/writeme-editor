import { Button, Tooltip, css } from "@g4rcez/components";
import { ArrowsCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowsCounterClockwise";
import { KeyboardIcon } from "@phosphor-icons/react/dist/csr/Keyboard";
import { MagnifyingGlassMinusIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlassMinus";
import { MagnifyingGlassPlusIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlassPlus";
import { MinusIcon } from "@phosphor-icons/react/dist/csr/Minus";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import flowchart from "flowchart.js";
import Raphael from "raphael";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useThemeChange } from "@/app/hooks/use-theme-change";
import { darkTheme } from "../../styles/dark";
import { lightTheme } from "../../styles/light";
import { parseHslaToHex } from "@/lib/color-utils";

if (typeof window !== "undefined") {
  (window as any).Raphael = Raphael;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const ZOOM_STEP = 1.2;
const PAN_STEP = 48;

const clampScale = (scale: number) =>
  Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE);

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
    "font-family": "Inter, sans-serif",
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
  const [isZoomEnabled, setIsZoomEnabled] = useState(true);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  const render = useCallback(() => {
    const container = containerRef.current;
    if (!container || !code) return;

    container.replaceChildren();
    setError(null);

    try {
      const isDark = document.documentElement.classList.contains("dark");
      const options = getFlowchartOptions(isDark);
      const diagram = flowchart.parse(code);
      diagram.drawSVG(container, options);

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
  }, [code]);

  useEffect(() => {
    render();
  }, [render]);

  useThemeChange(() => render());

  const zoomIn = useCallback(() => {
    setScale((current) => clampScale(current * ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((current) => clampScale(current / ZOOM_STEP));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleWheel = (event: React.WheelEvent) => {
    if (!isZoomEnabled) return;
    event.preventDefault();
    event.stopPropagation();
    setScale((current) => clampScale(current * (event.deltaY > 0 ? 0.9 : 1.1)));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isZoomEnabled) return;

    const key = event.key.toLowerCase();
    const panBy = (x: number, y: number) => {
      setPosition((current) => ({ x: current.x + x, y: current.y + y }));
    };

    if (key === "+" || key === "=") {
      event.preventDefault();
      zoomIn();
      return;
    }
    if (key === "-" || key === "_") {
      event.preventDefault();
      zoomOut();
      return;
    }
    if (key === "0") {
      event.preventDefault();
      resetZoom();
      return;
    }
    if (key === "arrowleft") {
      event.preventDefault();
      panBy(PAN_STEP, 0);
      return;
    }
    if (key === "arrowright") {
      event.preventDefault();
      panBy(-PAN_STEP, 0);
      return;
    }
    if (key === "arrowup") {
      event.preventDefault();
      panBy(0, PAN_STEP);
      return;
    }
    if (key === "arrowdown") {
      event.preventDefault();
      panBy(0, -PAN_STEP);
      return;
    }
    if (key === "?") {
      event.preventDefault();
      setShowKeyboardHelp((current) => !current);
    }
  };

  if (error) {
    return (
      <div className="p-2 font-mono text-sm text-red-600 bg-red-50 rounded dark:text-red-400 dark:bg-red-950">
        {error}
      </div>
    );
  }

  return (
    <div className="relative group overscroll-contain flowchart-block">
      <div className="absolute top-2 right-2 z-10 flex gap-1 rounded-md border border-border bg-background/80 p-1 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
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
          {isZoomEnabled ? "Disable zoom" : "Enable zoom"}
        </Tooltip>
        {isZoomEnabled && (
          <>
            <Tooltip
              title={
                <Button size="small" theme="muted" onClick={zoomIn}>
                  <PlusIcon size={14} />
                </Button>
              }
            >
              Zoom in (+)
            </Tooltip>
            <Tooltip
              title={
                <Button size="small" theme="muted" onClick={zoomOut}>
                  <MinusIcon size={14} />
                </Button>
              }
            >
              Zoom out (-)
            </Tooltip>
            <Tooltip
              title={
                <Button size="small" theme="muted" onClick={resetZoom}>
                  <ArrowsCounterClockwiseIcon size={14} />
                </Button>
              }
            >
              Reset zoom (0)
            </Tooltip>
            <Tooltip
              title={
                <Button
                  size="small"
                  theme={showKeyboardHelp ? "primary" : "muted"}
                  onClick={() => setShowKeyboardHelp((current) => !current)}
                >
                  <KeyboardIcon size={14} />
                </Button>
              }
            >
              Keyboard shortcuts
            </Tooltip>
          </>
        )}
      </div>

      {showKeyboardHelp && isZoomEnabled ? (
        <div className="absolute bottom-2 left-2 z-10 rounded-md border border-border bg-background/90 p-2 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
          <div>+ / - zoom</div>
          <div>0 reset</div>
          <div>Arrow keys pan</div>
          <div>? toggle help</div>
        </div>
      ) : null}

      <div
        aria-label="Flowchart preview. Use plus and minus to zoom, 0 to reset, and arrow keys to pan."
        className={css(
          "overflow-hidden rounded-lg border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40",
          isZoomEnabled &&
            "h-[400px] cursor-move border-border bg-card-background/30",
        )}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        role="img"
        tabIndex={0}
      >
        <div
          className={css(
            "flex h-full w-full items-center justify-center transition-transform duration-100",
            isZoomEnabled ? "p-8" : "p-0",
          )}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <div ref={containerRef} className="flowchart-container w-full" />
        </div>
      </div>
    </div>
  );
};
