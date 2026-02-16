import { useRef, useEffect, useState, useCallback } from "react";
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

export const TagsGraph = ({ nodes, links, onNodeClick }: TagsGraphProps) => {
  const [state] = useGlobalStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    window.addEventListener("resize", updateDimensions);
    updateDimensions();
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const bgColor = "hsl(var(--background))";
  const textColor = "hsl(var(--foreground))";
  const linkColor = "hsl(var(--foreground))";
  const fileColor =
    state.theme === "dark" ? "hsla(215, 100%, 70%)" : "hsla(215, 100%, 70%)";
  const tagColor =
    state.theme === "dark" ? "hsla(35, 100%, 70%)" : "hsla(35, 100%, 70%)";

  return (
    <div ref={containerRef} className="w-full h-full">
      <ForceGraph2D
        linkWidth={2}
        enableNodeDrag
        autoPauseRedraw
        nodeRelSize={2000}
        nodeLabel="name"
        showPointerCursor
        cooldownTime={5000}
        cooldownTicks={5000}
        enablePanInteraction
        enableZoomInteraction
        enablePointerInteraction
        width={dimensions.width}
        backgroundColor={bgColor}
        linkColor={() => linkColor}
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
            // ctx.fillText(label, node.x, y, 200);
            wrapText(ctx, label, node.x, y, 220, fontSize + 2.5);
          }
        }}
      />
    </div>
  );
};
