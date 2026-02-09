import { useRef, useEffect, useState, useCallback } from "react";
import ForceGraph2D from "react-force-graph-2d";

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

export const TagsGraph = ({ nodes, links, onNodeClick }: TagsGraphProps) => {
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

  const bgColor = "hsl(var(--floating-background))";
  const textColor = "hsl(var(--foreground))";
  const linkColor = "hsl(var(--foreground))";
  const fileColor = "#0069A8";
  const tagColor = "#7F22FE";

  return (
    <div ref={containerRef} className="w-full h-full">
      <ForceGraph2D
        linkWidth={2}
        enableNodeDrag
        autoPauseRedraw
        nodeRelSize={6}
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
            ctx.fillText(label, node.x, node.y + node.val + fontSize);
          }
        }}
      />
    </div>
  );
};
