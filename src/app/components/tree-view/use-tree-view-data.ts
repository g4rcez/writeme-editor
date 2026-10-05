import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isElectron } from "@/lib/is-electron";
import { type FileSearchEvent, type FlattenedNode, type TreeNode } from "@/types/tree";
import { createFileSearchRequestId, flattenVisibleNodes, type FileSearchStatus } from "./tree-view-utils";

export const useTreeViewData = (rootPath: string, searchQuery: string) => {
    const [rootChildren, setRootChildren] = useState<TreeNode[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [isRequestingAccess, setIsRequestingAccess] = useState(false);
    const [expandedPaths, setExpandedPaths] = useState(() => new Set<string>());
    const [childrenCache, setChildrenCache] = useState(new Map<string, TreeNode[]>());
    const [loadingPaths, setLoadingPaths] = useState(new Set<string>());
    const [searchResults, setSearchResults] = useState<TreeNode[]>([]);
    const [searchStatus, setSearchStatus] = useState<FileSearchStatus>("idle");
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchTruncated, setSearchTruncated] = useState(false);
    const [searchRefreshToken, setSearchRefreshToken] = useState(0);
    const hasRequestedDirectoryAccessRef = useRef(false);
    const childrenCacheRef = useRef(new Map<string, TreeNode[]>());
    const expandedPathsRef = useRef(new Set<string>());
    const flattenedNodesRef = useRef<FlattenedNode[]>([]);
    const isSearching = searchQuery.trim().length > 0;

    const loadRoot = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await window.electronAPI.fs.readDir(rootPath);
            if (result.error) {
                setError(result.error);
                setPermissionDenied(result.errorCode === "EPERM" || result.errorCode === "EACCES");
            } else {
                setPermissionDenied(false);
                setRootChildren(result.entries);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load directory");
        } finally {
            setIsLoading(false);
        }
    }, [rootPath]);

    const requestDirectoryAccess = useCallback(async () => {
        setIsRequestingAccess(true);
        try {
            const result = await window.electronAPI.fs.requestDirectoryAccess(rootPath);
            if (result.granted) {
                await loadRoot();
                return;
            }
            setError(result.error ?? "Folder access was not granted");
        } catch (accessError) {
            setError(accessError instanceof Error ? accessError.message : "Failed to request folder access");
        } finally {
            setIsRequestingAccess(false);
        }
    }, [loadRoot, rootPath]);

    useEffect(() => {
        loadRoot();
    }, [loadRoot]);

    useEffect(() => {
        const query = searchQuery.trim();
        if (!query) {
            setSearchResults([]);
            setSearchStatus("idle");
            setSearchError(null);
            setSearchTruncated(false);
            return;
        }

        const fsApi = window.electronAPI.fs;
        if (typeof fsApi.startFileSearch !== "function" || typeof fsApi.onFileSearchEvent !== "function") {
            setSearchStatus("error");
            setSearchError("Recursive file search is unavailable");
            return;
        }

        const requestId = createFileSearchRequestId();
        let isCurrentSearch = true;
        setSearchResults([]);
        setSearchStatus("loading");
        setSearchError(null);
        setSearchTruncated(false);

        const unsubscribe = fsApi.onFileSearchEvent((event: FileSearchEvent) => {
            if (!isCurrentSearch || event.requestId !== requestId) return;

            if (event.type === "batch") {
                startTransition(() => {
                    setSearchResults((previous) => [...previous, ...event.entries]);
                });
                return;
            }

            if (event.type === "complete") {
                setSearchStatus("complete");
                setSearchTruncated(event.truncated);
                return;
            }

            setSearchStatus("error");
            setSearchError(event.error);
        });

        const timeoutId = window.setTimeout(() => {
            void fsApi
                .startFileSearch(rootPath, query, requestId)
                .then((result) => {
                    if (!isCurrentSearch || result.success) return;
                    setSearchStatus("error");
                    setSearchError(result.error);
                })
                .catch((reason: unknown) => {
                    if (!isCurrentSearch) return;
                    setSearchStatus("error");
                    setSearchError(reason instanceof Error ? reason.message : "Failed to search workspace files");
                });
        }, 180);

        return () => {
            isCurrentSearch = false;
            window.clearTimeout(timeoutId);
            unsubscribe();
            if (typeof fsApi.cancelFileSearch === "function") {
                void fsApi.cancelFileSearch(requestId).catch(() => undefined);
            }
        };
    }, [rootPath, searchQuery, searchRefreshToken]);

    useEffect(() => {
        if (!permissionDenied || hasRequestedDirectoryAccessRef.current) return;
        hasRequestedDirectoryAccessRef.current = true;
        void requestDirectoryAccess();
    }, [permissionDenied, requestDirectoryAccess]);

    useEffect(() => {
        if (!isElectron()) return;
        return window.electronAPI.fs.onDirChanged(({ dirPath }) => {
            if (isSearching) setSearchRefreshToken((previous) => previous + 1);
            if (dirPath === rootPath) {
                loadRoot();
            } else if (childrenCacheRef.current.has(dirPath)) {
                window.electronAPI.fs.readDir(dirPath).then((result) => {
                    setChildrenCache((prev) => new Map(prev).set(dirPath, result.entries || []));
                });
            }
        });
    }, [isSearching, rootPath, loadRoot]);

    const flattenedNodes = useMemo(() => {
        if (isSearching) {
            return searchResults.map((node): FlattenedNode => ({
                node,
                depth: 0,
                isExpanded: false,
                parentPath: null,
            }));
        }
        if (!rootChildren) return [];
        return flattenVisibleNodes(rootChildren, expandedPaths, childrenCache, "");
    }, [isSearching, searchResults, rootChildren, expandedPaths, childrenCache]);

    useEffect(() => {
        childrenCacheRef.current = childrenCache;
    }, [childrenCache]);
    useEffect(() => {
        expandedPathsRef.current = expandedPaths;
    }, [expandedPaths]);
    useEffect(() => {
        flattenedNodesRef.current = flattenedNodes;
    }, [flattenedNodes]);

    const refreshDirectory = useCallback(
        async (path: string) => {
            if (path === rootPath) {
                await loadRoot();
                return;
            }

            const result = await window.electronAPI.fs.readDir(path);
            setChildrenCache((prev) => new Map(prev).set(path, result.entries || []));
        },
        [loadRoot, rootPath],
    );

    const loadChildren = useCallback(async (path: string): Promise<TreeNode[]> => {
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
    }, []);

    const expandNode = useCallback(
        async (path: string) => {
            if (!childrenCacheRef.current.has(path)) {
                await loadChildren(path);
            }
            setExpandedPaths((prev) => new Set(prev).add(path));
        },
        [loadChildren],
    );

    const collapseNode = useCallback((path: string) => {
        setExpandedPaths((prev) => {
            const next = new Set(prev);
            next.delete(path);
            return next;
        });
    }, []);

    const toggleNode = useCallback(
        async (path: string) => {
            if (expandedPathsRef.current.has(path)) {
                collapseNode(path);
            } else {
                await expandNode(path);
            }
        },
        [expandNode, collapseNode],
    );

    return {
        rootChildren,
        isLoading,
        error,
        setError,
        permissionDenied,
        isRequestingAccess,
        requestDirectoryAccess,
        expandedPaths,
        setChildrenCache,
        childrenCacheRef,
        loadingPaths,
        isSearching,
        searchResults,
        searchStatus,
        searchError,
        searchTruncated,
        flattenedNodes,
        flattenedNodesRef,
        loadRoot,
        refreshDirectory,
        expandNode,
        collapseNode,
        toggleNode,
    };
};

export type TreeViewData = ReturnType<typeof useTreeViewData>;
