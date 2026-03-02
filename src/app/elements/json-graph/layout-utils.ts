import { type Node, type Edge, MarkerType } from "@xyflow/react";
import dagre from "dagre";

export type JsonNodeData = {
  label: string;
  value?: any;
  raw: any;
  type: "object" | "array" | "value";
  isExpanded: boolean;
  onToggle: () => void;
  onValueChange?: (newValue: string) => void;
  depth: number;
  fullPath: string;
  matchesSearch: boolean;
  isPathToMatch: boolean;
};

const NODE_WIDTH = 240;
const NODE_HEIGHT = 80;

export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = "LR",
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: direction, nodesep: 50, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export const transformJsonToGraph = (
  json: any,
  expandedPaths: Set<string>,
  onToggle: (path: string) => void,
  onValueChange: (path: string, newValue: string) => void,
  searchQuery = "",
  direction = "LR",
  highlightColor = "#0284c7",
): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const matchPaths = new Set<string>();

  // Helper to find all paths that match
  const findMatches = (data: any, path: string, label: string) => {
    const id = path || "$";
    const type = Array.isArray(data)
      ? "array"
      : typeof data === "object" && data !== null
        ? "object"
        : "value";

    const matches =
      !!searchQuery &&
      (label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (type === "value" &&
          String(data).toLowerCase().includes(searchQuery.toLowerCase())));

    let childMatched = false;
    if (type === "object") {
      Object.entries(data).forEach(([key, value]) => {
        if (findMatches(value, `${id}.${key}`, key)) childMatched = true;
      });
    } else if (type === "array") {
      (data as any[]).forEach((value, index) => {
        if (findMatches(value, `${id}[${index}]`, `[${index}]`))
          childMatched = true;
      });
    }

    if (matches || childMatched) {
      matchPaths.add(id);
      return true;
    }
    return false;
  };

  if (searchQuery) {
    findMatches(json, "", "$");
  }

  const traverse = (
    data: any,
    path: string,
    label: string,
    depth: number,
    parentId?: string,
  ) => {
    const id = path || "$";
    const type = Array.isArray(data)
      ? "array"
      : typeof data === "object" && data !== null
        ? "object"
        : "value";
    const isExpanded = expandedPaths.has(id);
    const isPathToMatch = matchPaths.has(id);

    const matchesSearch =
      !!searchQuery &&
      (label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (type === "value" &&
          String(data).toLowerCase().includes(searchQuery.toLowerCase())));

    // Filtering logic: if searching, only show nodes that are on the path or are matches
    if (searchQuery && !isPathToMatch) {
      return;
    }

    nodes.push({
      id,
      type: "jsonNode",
      data: {
        label,
        value: type === "value" ? data : undefined,
        raw: data,
        type,
        isExpanded,
        onToggle: () => onToggle(id),
        onValueChange: (val: string) => onValueChange(id, val),
        depth,
        fullPath: id,
        matchesSearch,
        isPathToMatch,
      },
      position: { x: 0, y: 0 },
    });

    if (parentId) {
      const isEdgeHighlighted = matchPaths.has(id);
      edges.push({
        id: `${parentId}-${id}`,
        source: parentId,
        target: id,
        animated: isEdgeHighlighted,
        style: isEdgeHighlighted
          ? { stroke: highlightColor, strokeWidth: 2 }
          : undefined,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isEdgeHighlighted ? highlightColor : undefined,
        },
      });
    }

    // Expand if user clicked or if it's part of a search path
    if (
      (isExpanded || (searchQuery && isPathToMatch)) &&
      (type === "object" || type === "array")
    ) {
      if (type === "object") {
        Object.entries(data).forEach(([key, value]) => {
          traverse(value, `${id}.${key}`, key, depth + 1, id);
        });
      } else {
        (data as any[]).forEach((value, index) => {
          traverse(value, `${id}[${index}]`, `[${index}]`, depth + 1, id);
        });
      }
    }
  };

  traverse(json, "", "$", 0);

  return getLayoutedElements(nodes, edges, direction);
};
