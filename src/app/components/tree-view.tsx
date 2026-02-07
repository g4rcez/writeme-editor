import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, File, Loader2, Trash2 } from "lucide-react";
import type { TreeNode, FlattenedNode } from "../../types/tree";

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  isExpanded: boolean;
  isFocused: boolean;
  isLoading: boolean;
  onActivate: () => void;
  onDelete?: (node: TreeNode) => void;
  onHover?: () => void;
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
}: TreeNodeItemProps) => {
  const isDirectory = node.type === "directory";
  const isMarkdown = node.extension === ".md";
  const itemRef = useRef<HTMLDivElement>(null);

  // Scroll into view when focused
  useEffect(() => {
    if (isFocused && itemRef.current) {
      itemRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [isFocused]);

  const paddingLeft = 12 + depth * 16;

  return (
    <div
      ref={itemRef}
      role="treeitem"
      tabIndex={isFocused ? 0 : -1}
      aria-expanded={isDirectory ? isExpanded : undefined}
      aria-selected={isFocused}
      className={`
        group flex items-center gap-2 py-1.5 px-2 cursor-pointer rounded-md transition-colors
        ${isFocused ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-gray-100 dark:hover:bg-gray-800/50"}
        ${!isDirectory && !isMarkdown ? "opacity-50 cursor-default" : ""}
      `}
      style={{ paddingLeft }}
      onClick={onActivate}
      onMouseEnter={onHover}
    >
      {isDirectory ? (
        <>
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          ) : isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-yellow-500" />
          ) : (
            <Folder className="w-4 h-4 text-yellow-500" />
          )}
        </>
      ) : (
        <>
          <span className="w-4" /> {/* Spacer for alignment */}
          {isMarkdown ? (
            <FileText className="w-4 h-4 text-blue-500" />
          ) : (
            <File className="w-4 h-4 text-gray-400" />
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
        <button
          className="p-1 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node);
          }}
          title="Delete"
        >
          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500 transition-colors" />
        </button>
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
  parentPath: string | null = null
): FlattenedNode[] => {
  const query = searchQuery.toLowerCase();

  return nodes.flatMap((node) => {
    const children = node.type === "directory" ? childrenCache.get(node.path) || [] : [];
    
    // Check if this node or any of its children (recursively) match the search query
    const matchesSearch = !query || node.name.toLowerCase().includes(query);
    const hasMatchingChild = query && node.type === "directory" && (
        children.some(child => child.name.toLowerCase().includes(query)) ||
        // We might need recursive check here for deep matches
        // but for simplicity let's check one level or use a pre-calculated map
        false 
    );

    // If searching, we auto-expand or show if it has matches
    const isExpanded = query ? true : expandedPaths.has(node.path);
    
    // In search mode, we only show nodes that match or have matching children
    // Actually, for a simple tree search, we often show matching items and their parents
    if (query && !matchesSearch && !hasMatchingChild) {
        // Advanced: check children recursively
        const subResult = flattenVisibleNodes(children, expandedPaths, childrenCache, searchQuery, depth + 1, node.path);
        if (subResult.length === 0) return [];
        
        // If we found matches in subResult, we must show this parent node too
        return [{ node, depth, isExpanded, parentPath }, ...subResult];
    }

    const result: FlattenedNode[] = [{ node, depth, isExpanded, parentPath }];

    if (node.type === "directory" && isExpanded) {
      result.push(...flattenVisibleNodes(children, expandedPaths, childrenCache, searchQuery, depth + 1, node.path));
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

export const TreeView = ({ rootPath, onFileSelect, onDelete, onFocusChange, searchQuery = "" }: TreeViewProps) => {
  const [rootChildren, setRootChildren] = useState<TreeNode[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lifted state for expansion and caching
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [childrenCache, setChildrenCache] = useState<Map<string, TreeNode[]>>(new Map());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

  // Keyboard navigation state
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

  // Load root directory on mount
  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  // Flatten visible nodes for navigation
  const flattenedNodes = useMemo(() => {
    if (!rootChildren) return [];
    return flattenVisibleNodes(rootChildren, expandedPaths, childrenCache, searchQuery);
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
  const loadChildren = useCallback(async (path: string): Promise<TreeNode[]> => {
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
  }, [childrenCache]); // Careful with deps here

  // Expand a directory
  const expandNode = useCallback(async (path: string) => {
    // Always load fresh children when expanding? 
    // Or only if not in cache? 
    // For now, standard behavior: load if not cached or force via other means.
    // The loadChildren above checks cache.
    // If we want to refresh, we must clear cache first.
    if (!childrenCache.has(path)) {
        await loadChildren(path);
    }
    setExpandedPaths((prev) => new Set(prev).add(path));
  }, [loadChildren, childrenCache]);

  // Collapse a directory
  const collapseNode = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  // Toggle expand/collapse
  const toggleNode = useCallback(async (path: string) => {
    if (expandedPaths.has(path)) {
      collapseNode(path);
    } else {
      await expandNode(path);
    }
  }, [expandedPaths, expandNode, collapseNode]);

  // Activate node (expand folder or open .md file)
  const activateNode = useCallback(async (flatNode: FlattenedNode) => {
    const { node } = flatNode;
    if (node.type === "directory") {
      await toggleNode(node.path);
    } else if (node.extension === ".md") {
      onFileSelect(node);
    }
  }, [toggleNode, onFileSelect]);

  const handleNodeDelete = useCallback(async (node: TreeNode) => {
    if (!onDelete) return;
    
    const success = await onDelete(node);
    if (success) {
      // Refresh logic
      // Check if node is in root
      if (rootChildren?.some(n => n.path === node.path)) {
        loadRoot();
        return;
      }

      // Check cache for parent
      for (const [parentPath, children] of childrenCache.entries()) {
        if (children.some(n => n.path === node.path)) {
           // Reload this parent
           // We need to bypass cache check in loadChildren.
           // Simplest: clear cache entry then load.
           setChildrenCache(prev => {
               const next = new Map(prev);
               next.delete(parentPath);
               return next;
           });
           // We can't call loadChildren immediately because state update is async
           // and loadChildren checks current state cache.
           // However, setState accepts a callback or we can pass a 'force' arg if we modify loadChildren.
           
           // Better: Direct call to API and update state.
           window.electronAPI.fs.readDir(parentPath).then(result => {
               const newChildren = result.entries || [];
               setChildrenCache(prev => new Map(prev).set(parentPath, newChildren));
           });
           return;
        }
      }
    }
  }, [onDelete, rootChildren, childrenCache, loadRoot]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (flattenedNodes.length === 0) return;

      const currentNode = flattenedNodes[focusedIndex];
      if (!currentNode) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, flattenedNodes.length - 1));
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
              (n) => n.node.path === currentNode.parentPath
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
            await handleNodeDelete(currentNode.node);
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
  }, [flattenedNodes, focusedIndex, expandNode, collapseNode, activateNode, childrenCache, onDelete, handleNodeDelete]);

  // Focus container on mount
  useEffect(() => {
    if (rootChildren && rootChildren.length > 0) {
      containerRef.current?.focus();
    }
  }, [rootChildren]);

  if (isLoading && !rootChildren) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        <span className="ml-2 text-gray-500">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        <p>Error loading directory:</p>
        <p className="text-sm mt-1">{error}</p>
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
        />
      ))}
    </div>
  );
};