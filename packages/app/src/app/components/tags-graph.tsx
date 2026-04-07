import { useEffect, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useGlobalStore } from "../../store/global.store";

interface GraphNode {
  id: string;
  name: string;
  type: "note" | "tag";
  val: number;
  color?: string;
  noteId?: string;
}

interface GraphLink {
  source: string;
  target: string;
  type?: "tag" | "mention";
}

interface TagsGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  onNodeClick: (node: GraphNode) => void;
}

const wrapText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) => {
  const words = text.split(" ");
  let line = "";

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = context.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      context.fillText(line, x, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  context.fillText(line, x, y);
};

const resolveVar = (v: string) => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  return `hsl(${raw})`;
};

export const TagsGraph = ({ nodes, links, onNodeClick }: TagsGraphProps) => {
  const [state] = useGlobalStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const bgColor = resolveVar("--background");
  const textColor = resolveVar("--foreground");
  const linkColor = resolveVar("--foreground");
  const fileColor =
    state.theme === "dark" ? "hsla(215, 100%, 70%)" : "hsla(215, 100%, 70%)";
  const tagColor =
    state.theme === "dark" ? "hsla(35, 100%, 70%)" : "hsla(35, 100%, 70%)";

  const mentionLinkColor = resolveVar("--primary");

  return (
    <div ref={containerRef} className="w-full h-full">
      {dimensions.width > 0 && (
        <ForceGraph2D
          enableNodeDrag
          nodeLabel="name"
          showPointerCursor
          nodeRelSize={5}
          cooldownTime={5000}
          cooldownTicks={5000}
          enablePanInteraction
          enableZoomInteraction
          enablePointerInteraction
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor={bgColor}
          linkHoverPrecision={10000}
          linkColor={(link: any) => link.type === "mention" ? mentionLinkColor : linkColor}
          linkWidth={(link: any) => link.type === "mention" ? 1 : 2}
          linkLineDash={(link: any) => link.type === "mention" ? [4, 2] : []}
          linkDirectionalArrowLength={(link: any) => link.type === "mention" ? 4 : 0}
          linkDirectionalArrowRelPos={1}
          graphData={{ nodes, links }}
          nodeCanvasObjectMode={() => "replace"}
          onNodeClick={(node: any) => onNodeClick(node)}
          nodeColor={(node: any) =>
            node.color || (node.type === "tag" ? tagColor : fileColor)
          }
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            const label = node.name;
            const fontSize = 14 / globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle =
              node.color || (node.type === "tag" ? tagColor : fileColor);
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
            ctx.fill();
            if (globalScale > 1.5 || node.type === "tag") {
              ctx.fillStyle = textColor;
              const y = node.y + node.val + fontSize;
              wrapText(ctx, label, node.x, y, 220, fontSize + 2.5);
            }
          }}
        />
      )}
    </div>
  );
};
