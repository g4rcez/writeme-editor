import { Button, Tooltip, css, Input } from "@g4rcez/components";
import { ArrowCircleDownIcon } from "@phosphor-icons/react/dist/csr/ArrowCircleDown";
import { ArrowCircleRightIcon } from "@phosphor-icons/react/dist/csr/ArrowCircleRight";
import { CornersOutIcon } from "@phosphor-icons/react/dist/csr/CornersOut";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { MinusCircleIcon } from "@phosphor-icons/react/dist/csr/MinusCircle";
import { PlusCircleIcon } from "@phosphor-icons/react/dist/csr/PlusCircle";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng, toSvg } from "html-to-image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { JsonNode } from "./json-node";
import { transformJsonToGraph } from "./layout-utils";
import { useGlobalStore } from "@/store/global.store";
import { darkTheme } from "@/app/styles/dark";
import { lightTheme } from "@/app/styles/light";
import { parseHslaToHex } from "@/lib/editor-utils";

const ROOT_NAME = "$";

const updateDeep = (
  obj: any,
  currentPath: string,
  targetPath: string,
  val: any,
  newValue: any,
): any => {
  if (
    currentPath === targetPath ||
    (currentPath === "" && targetPath === ROOT_NAME)
  ) {
    try {
      if (newValue === "true") return true;
      if (newValue === "false") return false;
      if (!isNaN(Number(newValue)) && newValue.trim() !== "")
        return Number(newValue);
      return JSON.parse(newValue);
    } catch {
      return newValue;
    }
  }
  if (Array.isArray(obj)) {
    return obj.map((item, i) =>
      updateDeep(item, `${currentPath}[${i}]`, targetPath, val, newValue),
    );
  } else if (typeof obj === "object" && obj !== null) {
    const newObj = { ...obj };
    for (const key in newObj) {
      const nextPath = currentPath ? `${currentPath}.${key}` : key;
      newObj[key] = updateDeep(
        newObj[key],
        nextPath,
        targetPath,
        val,
        newValue,
      );
    }
    return newObj;
  }
  return obj;
};

const nodeTypes = {
  jsonNode: JsonNode,
};

const JsonGraphInner = ({
  json,
  onChange,
}: {
  json: any;
  onChange?: (newJson: any) => void;
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    new Set(["$"]),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [direction, setDirection] = useState<"LR" | "TB">("LR");
  const [isZenMode, setIsZenMode] = useState(false);
  const { fitView } = useReactFlow();
  const [state] = useGlobalStore();
  const theme = state.theme === "dark" ? darkTheme : lightTheme;
  const isDark = state.theme === "dark";

  const colors = useMemo(
    () => ({
      border: parseHslaToHex(theme.colors.border),
      info: parseHslaToHex(theme.colors.info.DEFAULT),
      card: parseHslaToHex(theme.colors.card.background),
      background: parseHslaToHex(theme.colors.background),
      primary: parseHslaToHex(theme.colors.primary.DEFAULT),
      success: parseHslaToHex(theme.colors.success.DEFAULT),
      secondary: parseHslaToHex(theme.colors.secondary.DEFAULT),
      muted: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
    }),
    [theme, isDark],
  );

  const onToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const onValueChange = useCallback(
    (path: string, newValue: string) => {
      if (!onChange) return;
      const newJson = updateDeep(json, ROOT_NAME, path, newValue, newValue);
      onChange(newJson);
    },
    [json, onChange],
  );

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () =>
      transformJsonToGraph(
        json,
        expandedPaths,
        onToggle,
        onValueChange,
        searchQuery,
        direction,
        colors.primary,
      ),
    [
      json,
      expandedPaths,
      onToggle,
      onValueChange,
      searchQuery,
      direction,
      colors.primary,
    ],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setTimeout(() => fitView({ duration: 400 }), 50);
  }, [initialNodes, initialEdges, setNodes, setEdges, fitView]);

  const onExport = useCallback(
    (format: "png" | "svg") => {
      const element = document.querySelector(
        ".react-flow__viewport",
      ) as HTMLElement;
      if (!element) return;

      const fn = format === "png" ? toPng : toSvg;
      fn(element, {
        backgroundColor: colors.background,
        style: {
          transform: "scale(2)",
          transformOrigin: "top left",
        },
      }).then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `json-graph.${format}`;
        link.href = dataUrl;
        link.click();
      });
    },
    [colors.background],
  );

  const expandAll = () => {
    const allPaths = new Set<string>();
    const traverse = (data: any, path: string) => {
      const id = path || ROOT_NAME;
      allPaths.add(id);
      if (Array.isArray(data)) {
        data.forEach((v, i) => traverse(v, `${id}[${i}]`));
      } else if (typeof data === "object" && data !== null) {
        Object.entries(data).forEach(([k, v]) => traverse(v, `${id}.${k}`));
      }
    };
    traverse(json, "");
    setExpandedPaths(allPaths);
  };

  const collapseAll = () => setExpandedPaths(new Set([ROOT_NAME]));

  return (
    <div
      className={css(
        "flex overflow-hidden flex-col w-full h-full transition-all duration-500",
        isZenMode
          ? "fixed inset-0 z-50 bg-background"
          : "relative bg-background",
      )}
    >
      <div className="flex gap-4 justify-between items-center p-3 border-b bg-background border-border/5">
        <div className="flex gap-1 items-center">
          <div className="flex items-center">
            <Input
              hiddenLabel
              value={searchQuery}
              placeholder="Search keys or values..."
              left={<MagnifyingGlassIcon size={16} className="text-primary" />}
              className="w-64"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="mx-1 w-px h-6 bg-border/10" />
          <div className="flex gap-1">
            <Tooltip
              title={
                <Button size="small" onClick={expandAll} theme="ghost-primary">
                  <PlusCircleIcon size={18} />
                </Button>
              }
            >
              Expand all
            </Tooltip>
            <Tooltip
              title={
                <Button size="small" theme="ghost-muted" onClick={collapseAll}>
                  <MinusCircleIcon size={18} />
                </Button>
              }
            >
              Collapse all
            </Tooltip>
          </div>
        </div>
        <div className="flex gap-1.5 items-center">
          <Tooltip
            title={
              <Button
                size="small"
                theme="muted"
                onClick={() => setDirection((d) => (d === "LR" ? "TB" : "LR"))}
              >
                {direction === "LR" ? (
                  <ArrowCircleDownIcon size={18} />
                ) : (
                  <ArrowCircleRightIcon size={18} />
                )}
              </Button>
            }
          >
            {direction === "LR" ? "Switch to Vertical" : "Switch to Horizontal"}
          </Tooltip>
          <Tooltip
            title={
              <Button
                size="small"
                theme="muted"
                onClick={() => onExport("png")}
              >
                <DownloadSimpleIcon size={18} />
              </Button>
            }
          >
            Export PNG
          </Tooltip>
          <Tooltip
            title={
              <Button
                size="small"
                theme={isZenMode ? "primary" : "muted"}
                onClick={() => setIsZenMode(!isZenMode)}
              >
                <CornersOutIcon size={18} />
              </Button>
            }
          >
            {isZenMode ? "Exit zen mode" : "Zen mode"}
          </Tooltip>
        </div>
      </div>

      <div className="relative flex-1">
        <ReactFlow
          fitView
          maxZoom={2}
          edges={edges}
          nodes={nodes}
          minZoom={0.05}
          nodeTypes={nodeTypes}
          onEdgesChange={onEdgesChange}
          onNodesChange={onNodesChange}
          defaultEdgeOptions={{
            style: { stroke: colors.border, strokeWidth: 1.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: colors.border },
          }}
        >
          <Background
            gap={24}
            size={1}
            variant={BackgroundVariant.Dots}
            color={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
          />
          <Controls className="!bg-card-background !border-border/20 !fill-foreground" />
          <MiniMap
            className="!bg-card-background !border-border/20"
            nodeStrokeColor={colors.primary}
            nodeColor={(n: any) => {
              if (n.data.type === "object") return colors.info;
              if (n.data.type === "array") return colors.secondary;
              return colors.success;
            }}
            maskColor={
              isDark ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.4)"
            }
          />
        </ReactFlow>
      </div>
    </div>
  );
};

export const JsonGraph = (props: {
  json: any;
  onChange?: (newJson: any) => void;
}) => (
  <ReactFlowProvider>
    <JsonGraphInner {...props} />
  </ReactFlowProvider>
);
