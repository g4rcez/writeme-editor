import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { FolderIcon } from "@phosphor-icons/react/dist/csr/Folder";
import { FolderOpenIcon } from "@phosphor-icons/react/dist/csr/FolderOpen";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { FileIcon } from "@phosphor-icons/react/dist/csr/File";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { Tooltip, Button } from "@g4rcez/components";
import type { TreeNode, FlattenedNode } from "@/types/tree";

interface TreeNodeItemProps {
  depth: number;
  node: TreeNode;
  isFocused: boolean;
  isLoading: boolean;
  isExpanded: boolean;
  onHover?: () => void;
  isConfirming: boolean;
  onActivate: () => void;
  onConfirmCancel: () => void;
  onConfirmDelete: () => void;
  onConfirmRequest: () => void;
  onDelete?: (node: TreeNode) => void;
}

const TreeNodeItem = ({
  node,
  depth,
  isExpanded,
  isFocused,
  isLoading,
  onActivate,
  onDelete,
  onHover,
  isConfirming,
  onConfirmRequest,
  onConfirmCancel,
  onConfirmDelete,
}: TreeNodeItemProps) => {
  const isDirectory = node.type === "directory";
  const isMarkdown = node.extension === ".md";
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused && itemRef.current) {
      itemRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [isFocused]);

  const paddingLeft = 12 + depth * 16;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConfirmDelete();
  };

  return (
    <div
      ref={itemRef}
      role="treeitem"
      aria-selected={isFocused}
      tabIndex={isFocused ? 0 : -1}
      aria-expanded={isDirectory ? isExpanded : undefined}
      className={`
        group flex items-center gap-2 py-1.5 px-2 cursor-pointer rounded transition-colors
        ${isFocused ? "bg-primary-subtle/40" : "hover:bg-muted"}
        ${!isDirectory && !isMarkdown ? "opacity-50 cursor-default" : ""}
      `}
      style={{ paddingLeft }}
      onClick={onActivate}
      onMouseEnter={onHover}
    >
      {isDirectory ? (
        <>
          {isLoading ? (
            <CircleNotchIcon className="animate-spin size-4 text-muted" />
          ) : isExpanded ? (
            <CaretDownIcon className="size-4" />
          ) : (
            <CaretRightIcon className="size-4" />
          )}
          {isExpanded ? (
            <FolderOpenIcon className="size-4 text-secondary" />
          ) : (
            <FolderIcon className="size-4 text-warn" />
          )}
        </>
      ) : (
        <>
          <span className="w-4" />
          {isMarkdown ? (
            <FileTextIcon className="text-blue-500 size-4" />
          ) : (
            <FileIcon className="text-gray-400 size-4" />
          )}
        </>
      )}
      <span
        className={`
          text-sm truncate flex-1
          ${isFocused ? "text-blue-600 dark:text-blue-400 font-medium" : "text-gray-700 dark:text-gray-300"}
          ${!isDirectory && !isMarkdown ? "text-gray-400 dark:text-gray-600" : ""}
        `}
      >
        {node.name}
      </span>

      {onDelete && (
        <Tooltip
          open={isConfirming}
          onChange={(open) => !open && onConfirmCancel()}
          placement="top-start"
          title={
            <button
              className="p-1 rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-100 focus:opacity-100 dark:hover:bg-red-900/30"
              onClick={(e) => {
                e.stopPropagation();
                onConfirmRequest();
              }}
              title="Delete"
            >
              <TrashIcon className="text-gray-400 transition-colors hover:text-red-500 size-4" />
            </button>
          }
        >
          <div
            className="flex flex-col gap-3 p-3 rounded-xl min-w-[200px]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium">
              Delete this {isDirectory ? "directory" : "file"}?
            </p>
            <p className="text-xs text-muted-foreground">
              This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button size="small" theme="muted" onClick={onConfirmCancel}>
                Cancel
              </Button>
              <Button size="small" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        </Tooltip>
      )}
    </div>
  );
};

// Flatten visible nodes for keyboard navigation
const flattenVisibleNodes = (
  nodes: TreeNode[],
  expandedPaths: Set<string>,
  childrenCache: Map<string, TreeNode[]>,
  searchQuery: string,
  depth = 0,
  parentPath: string | null = null,
): FlattenedNode[] => {
  const query = searchQuery.toLowerCase();

  return nodes.flatMap((node) => {
    const children =
      node.type === "directory" ? childrenCache.get(node.path) || [] : [];

    // Check if this node or any of its children (recursively) match the search query
    const matchesSearch = !query || node.name.toLowerCase().includes(query);
    const hasMatchingChild =
      query &&
      node.type === "directory" &&
      (children.some((child) => child.name.toLowerCase().includes(query)) ||
        // We might need recursive check here for deep matches
        // but for simplicity let's check one level or use a pre-calculated map
        false);

    // If searching, we auto-expand or show if it has matches
    const isExpanded = query ? true : expandedPaths.has(node.path);

    // In search mode, we only show nodes that match or have matching children
    // Actually, for a simple tree search, we often show matching items and their parents
    if (query && !matchesSearch && !hasMatchingChild) {
      // Advanced: check children recursively
      const subResult = flattenVisibleNodes(
        children,
        expandedPaths,
        childrenCache,
        searchQuery,
        depth + 1,
        node.path,
      );
      if (subResult.length === 0) return [];

      // If we found matches in subResult, we must show this parent node too
      return [{ node, depth, isExpanded, parentPath }, ...subResult];
    }

    const result: FlattenedNode[] = [{ node, depth, isExpanded, parentPath }];

    if (node.type === "directory" && isExpanded) {
      result.push(
        ...flattenVisibleNodes(
          children,
          expandedPaths,
          childrenCache,
          searchQuery,
          depth + 1,
          node.path,
        ),
      );
    }

    return result;
  });
};

interface TreeViewProps {
  rootPath: string;
  onFileSelect: (node: TreeNode) => void;
  onDelete?: (node: TreeNode) => Promise<boolean>;
  onFocusChange?: (node: TreeNode | null) => void;
  searchQuery?: string;
}

export const TreeView = ({
  rootPath,
  onFileSelect,
  onDelete,
  onFocusChange,
  searchQuery = "",
}: TreeViewProps) => {
  const [rootChildren, setRootChildren] = useState<TreeNode[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedPaths, setExpandedPaths] = useState(() => new Set<string>());
  const [childrenCache, setChildrenCache] = useState(
    new Map<string, TreeNode[]>(),
  );
  const [loadingPaths, setLoadingPaths] = useState(new Set<string>());
  const [confirmingPath, setConfirmingPath] = useState<string | null>(null);

  const [focusedIndex, setFocusedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadRoot = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.fs.readDir(rootPath);
      if (result.error) {
        setError(result.error);
      } else {
        setRootChildren(result.entries);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load directory");
    } finally {
      setIsLoading(false);
    }
  }, [rootPath]);

  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  const flattenedNodes = useMemo(() => {
    if (!rootChildren) return [];
    return flattenVisibleNodes(
      rootChildren,
      expandedPaths,
      childrenCache,
      searchQuery,
    );
  }, [rootChildren, expandedPaths, childrenCache, searchQuery]);

  // Clamp focusedIndex when flattenedNodes changes
  useEffect(() => {
    if (flattenedNodes.length > 0 && focusedIndex >= flattenedNodes.length) {
      setFocusedIndex(flattenedNodes.length - 1);
    }
  }, [flattenedNodes.length, focusedIndex]);

  useEffect(() => {
    if (onFocusChange) {
      onFocusChange(flattenedNodes[focusedIndex]?.node || null);
    }
  }, [flattenedNodes, focusedIndex, onFocusChange]);

  // Load children for a directory
  const loadChildren = useCallback(
    async (path: string): Promise<TreeNode[]> => {
      if (childrenCache.has(path)) {
        // Force reload if we are calling this explicitly (e.g. after delete),
        // but usually this is called by toggle/expand which might rely on cache.
        // For now, simple cache check.
        // To support force reload, we'd need a flag or manual cache invalidation before calling.
      }

      setLoadingPaths((prev) => new Set(prev).add(path));
      try {
        const result = await window.electronAPI.fs.readDir(path);
        const children = result.entries || [];
        setChildrenCache((prev) => new Map(prev).set(path, children));
        return children;
      } catch (error) {
        console.error("Failed to load directory:", error);
        setChildrenCache((prev) => new Map(prev).set(path, []));
        return [];
      } finally {
        setLoadingPaths((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
      }
    },
    [childrenCache],
  ); // Careful with deps here

  // Expand a directory
  const expandNode = useCallback(
    async (path: string) => {
      // Always load fresh children when expanding?
      // Or only if not in cache?
      // For now, standard behavior: load if not cached or force via other means.
      // The loadChildren above checks cache.
      // If we want to refresh, we must clear cache first.
      if (!childrenCache.has(path)) {
        await loadChildren(path);
      }
      setExpandedPaths((prev) => new Set(prev).add(path));
    },
    [loadChildren, childrenCache],
  );

  // Collapse a directory
  const collapseNode = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  // Toggle expand/collapse
  const toggleNode = useCallback(
    async (path: string) => {
      if (expandedPaths.has(path)) {
        collapseNode(path);
      } else {
        await expandNode(path);
      }
    },
    [expandedPaths, expandNode, collapseNode],
  );

  // Activate node (expand folder or open .md file)
  const activateNode = useCallback(
    async (flatNode: FlattenedNode) => {
      const { node } = flatNode;
      if (node.type === "directory") {
        await toggleNode(node.path);
      } else if (node.extension === ".md") {
        onFileSelect(node);
      }
    },
    [toggleNode, onFileSelect],
  );

  const handleNodeDelete = useCallback(
    async (node: TreeNode) => {
      if (!onDelete) return;

      const success = await onDelete(node);
      if (success) {
        setConfirmingPath(null);
        // Refresh logic
        // Check if node is in root
        if (rootChildren?.some((n) => n.path === node.path)) {
          loadRoot();
          return;
        }

        // Check cache for parent
        for (const [parentPath, children] of childrenCache.entries()) {
          if (children.some((n) => n.path === node.path)) {
            // Reload this parent
            // We need to bypass cache check in loadChildren.
            // Simplest: clear cache entry then load.
            setChildrenCache((prev) => {
              const next = new Map(prev);
              next.delete(parentPath);
              return next;
            });
            // We can't call loadChildren immediately because state update is async
            // and loadChildren checks current state cache.
            // However, setState accepts a callback or we can pass a 'force' arg if we modify loadChildren.

            // Better: Direct call to API and update state.
            window.electronAPI.fs.readDir(parentPath).then((result) => {
              const newChildren = result.entries || [];
              setChildrenCache((prev) =>
                new Map(prev).set(parentPath, newChildren),
              );
            });
            return;
          }
        }
      }
    },
    [onDelete, rootChildren, childrenCache, loadRoot],
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (flattenedNodes.length === 0) return;

      const currentNode = flattenedNodes[focusedIndex];
      if (!currentNode) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) =>
            Math.min(prev + 1, flattenedNodes.length - 1),
          );
          break;

        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;

        case "ArrowRight":
          e.preventDefault();
          if (currentNode.node.type === "directory") {
            if (!currentNode.isExpanded) {
              // Expand folder
              await expandNode(currentNode.node.path);
            } else {
              // Move to first child if expanded and has children
              const children = childrenCache.get(currentNode.node.path) || [];
              if (children.length > 0) {
                setFocusedIndex(focusedIndex + 1);
              }
            }
          }
          break;

        case "ArrowLeft":
          e.preventDefault();
          if (currentNode.node.type === "directory" && currentNode.isExpanded) {
            // Collapse folder
            collapseNode(currentNode.node.path);
          } else if (currentNode.parentPath) {
            // Move to parent
            const parentIndex = flattenedNodes.findIndex(
              (n) => n.node.path === currentNode.parentPath,
            );
            if (parentIndex !== -1) {
              setFocusedIndex(parentIndex);
            }
          }
          break;

        case "Enter":
        case " ":
          e.preventDefault();
          await activateNode(currentNode);
          break;

        case "Delete":
        case "Backspace":
          if (onDelete) {
            e.preventDefault();
            setConfirmingPath(currentNode.node.path);
          }
          break;

        case "Escape":
          if (confirmingPath) {
            e.preventDefault();
            setConfirmingPath(null);
          }
          break;

        case "n":
        case "N":
        case "m":
        case "M":
          // Let the parent handle these shortcuts
          break;

        default:
          return; // Don't stop propagation for other keys
      }
      e.stopPropagation();
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("keydown", handleKeyDown);
      return () => container.removeEventListener("keydown", handleKeyDown);
    }
  }, [
    flattenedNodes,
    focusedIndex,
    expandNode,
    collapseNode,
    activateNode,
    childrenCache,
    onDelete,
    handleNodeDelete,
    confirmingPath,
  ]);

  // Focus container on mount
  useEffect(() => {
    if (rootChildren && rootChildren.length > 0) {
      containerRef.current?.focus();
    }
  }, [rootChildren]);

  if (isLoading && !rootChildren) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        <span className="ml-2 text-gray-500">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        <p>Error loading directory:</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  if (!rootChildren || rootChildren.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No files found in this directory
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="tree"
      className="py-2 outline-none"
      tabIndex={0}
    >
      {flattenedNodes.map((flatNode, index) => (
        <TreeNodeItem
          key={flatNode.node.path}
          node={flatNode.node}
          depth={flatNode.depth}
          isExpanded={flatNode.isExpanded}
          isFocused={index === focusedIndex}
          isLoading={loadingPaths.has(flatNode.node.path)}
          onActivate={() => {
            setFocusedIndex(index);
            activateNode(flatNode);
          }}
          onDelete={onDelete ? handleNodeDelete : undefined}
          onHover={() => setFocusedIndex(index)}
          isConfirming={confirmingPath === flatNode.node.path}
          onConfirmRequest={() => setConfirmingPath(flatNode.node.path)}
          onConfirmCancel={() => setConfirmingPath(null)}
          onConfirmDelete={() => handleNodeDelete(flatNode.node)}
        />
      ))}
    </div>
  );
};
