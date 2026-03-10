import { getStroke } from "perfect-freehand";
import { Button } from "@g4rcez/components";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
import { CornersInIcon } from "@phosphor-icons/react/dist/csr/CornersIn";
import { CornersOutIcon } from "@phosphor-icons/react/dist/csr/CornersOut";
import { EraserIcon } from "@phosphor-icons/react/dist/csr/Eraser";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { useCallback, useEffect, useRef, useState } from "react";

type Point = [number, number, number];
type Stroke = { points: Point[]; color: string; size: number };
type FreehandData = { strokes: Stroke[] };

const COLORS = [
  { value: "#000000", label: "Black" },
  { value: "#ef4444", label: "Red" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#ffffff", label: "White" },
];

const SIZES = [
  { label: "Thin", size: 4, thinning: 0.5 },
  { label: "Medium", size: 8, thinning: 0.5 },
  { label: "Thick", size: 16, thinning: 0.5 },
];

function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return "";
  const first = stroke[0]!;
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const next = arr[(i + 1) % arr.length]!;
      const [x1, y1] = next;
      acc.push(x0!, y0!, (x0! + x1!) / 2, (y0! + y1!) / 2);
      return acc;
    },
    ["M", first[0]!, first[1]!, "Q"] as (string | number)[],
  );
  d.push("Z");
  return d.join(" ");
}

export const FreehandCode = (props: {
  code: string;
  autoDelete: () => void;
  onChange?: (s: string) => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#000000");
  const [sizeIndex, setSizeIndex] = useState(1);

  useEffect(() => {
    try {
      const data = JSON.parse(props.code) as FreehandData;
      if (data?.strokes) {
        setStrokes(data.strokes);
      }
    } catch {
      setStrokes([]);
    }
  }, []);

  const persist = useCallback(
    (nextStrokes: Stroke[]) => {
      props.onChange?.(JSON.stringify({ strokes: nextStrokes }));
    },
    [props.onChange],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pressure = e.pressure || 0.5;
      setIsDrawing(true);
      setCurrentPoints([[x, y, pressure]]);
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDrawing) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pressure = e.pressure || 0.5;
      setCurrentPoints((prev) => [...prev, [x, y, pressure]]);
    },
    [isDrawing],
  );

  const onPointerUp = useCallback(() => {
    if (!isDrawing || currentPoints.length === 0) return;
    const sizeConfig = SIZES[sizeIndex] ?? SIZES[1]!;
    const strokeColor = tool === "eraser" ? "#ffffff" : color;
    const newStroke: Stroke = {
      points: currentPoints,
      color: strokeColor,
      size: sizeConfig.size,
    };
    const nextStrokes = [...strokes, newStroke];
    setStrokes(nextStrokes);
    setCurrentPoints([]);
    setIsDrawing(false);
    persist(nextStrokes);
  }, [isDrawing, currentPoints, strokes, tool, color, sizeIndex, persist]);

  const handleUndo = useCallback(() => {
    const nextStrokes = strokes.slice(0, -1);
    setStrokes(nextStrokes);
    persist(nextStrokes);
  }, [strokes, persist]);

  const handleClear = useCallback(() => {
    setStrokes([]);
    persist([]);
  }, [persist]);

  const onRequestFullScreen = async () => {
    const div = ref.current;
    if (!div) return;
    if (isFullScreen) {
      await document.exitFullscreen();
      return setIsFullScreen(false);
    }
    await div.requestFullscreen();
    setIsFullScreen(true);
  };

  const FullScreenIcon = isFullScreen ? CornersInIcon : CornersOutIcon;
  const sizeConfig = SIZES[sizeIndex] ?? SIZES[1]!;

  const renderStroke = (stroke: Stroke, key: string | number) => {
    const outlinePoints = getStroke(stroke.points, {
      size: stroke.size,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    });
    const d = getSvgPathFromStroke(outlinePoints);
    return <path key={key} d={d} fill={stroke.color} />;
  };

  const currentOutline = getStroke(currentPoints, {
    size: sizeConfig.size,
    thinning: sizeConfig.thinning,
    smoothing: 0.5,
    streamline: 0.5,
  });
  const currentPath = getSvgPathFromStroke(currentOutline);
  const currentColor = tool === "eraser" ? "#ffffff" : color;

  return (
    <div ref={ref} className="relative w-full bg-card">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-card-border bg-card-background flex-wrap">
        {/* Color swatches */}
        <div className="flex gap-1 items-center">
          {COLORS.map((c) => (
            <button
              key={c.value}
              title={c.label}
              onClick={() => {
                setColor(c.value);
                setTool("pen");
              }}
              className="size-5 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: c.value,
                borderColor: color === c.value && tool === "pen" ? "#6366f1" : "#d1d5db",
              }}
            />
          ))}
        </div>
        <div className="w-px h-5 bg-card-border" />
        {/* Size selector */}
        <div className="flex gap-1 items-center">
          {SIZES.map((s, i) => (
            <button
              key={s.label}
              title={s.label}
              onClick={() => setSizeIndex(i)}
              className="flex items-center justify-center rounded transition-colors px-2 py-1 text-xs"
              style={{
                background: sizeIndex === i ? "#6366f1" : "transparent",
                color: sizeIndex === i ? "#fff" : "inherit",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-card-border" />
        {/* Tool toggle */}
        <Button
          size="small"
          theme={tool === "pen" ? "primary" : "ghost-primary"}
          onClick={() => setTool("pen")}
          title="Pen"
        >
          <PencilSimpleIcon size={14} />
        </Button>
        <Button
          size="small"
          theme={tool === "eraser" ? "primary" : "ghost-primary"}
          onClick={() => setTool("eraser")}
          title="Eraser"
        >
          <EraserIcon size={14} />
        </Button>
        <div className="w-px h-5 bg-card-border" />
        {/* Actions */}
        <Button size="small" theme="ghost-primary" onClick={handleUndo} title="Undo" disabled={strokes.length === 0}>
          <ArrowCounterClockwiseIcon size={14} />
        </Button>
        <Button size="small" theme="ghost-danger" onClick={handleClear} title="Clear all" disabled={strokes.length === 0}>
          Clear
        </Button>
        <div className="ml-auto flex gap-2">
          <Button size="small" theme="ghost-primary" onClick={onRequestFullScreen}>
            <FullScreenIcon size={14} />
          </Button>
          <Button size="small" theme="ghost-danger" onClick={props.autoDelete}>
            <TrashIcon size={14} />
          </Button>
        </div>
      </div>
      {/* Canvas */}
      <svg
        ref={svgRef}
        className="w-full touch-none"
        style={{ height: 480, background: "transparent", cursor: tool === "eraser" ? "cell" : "crosshair" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {strokes.map((s, i) => renderStroke(s, i))}
        {currentPoints.length > 0 && currentPath && (
          <path d={currentPath} fill={currentColor} />
        )}
      </svg>
    </div>
  );
};
