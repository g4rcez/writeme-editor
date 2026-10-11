type FileEntry = { name: string; path: string; relativePath: string };
type FileResult = { success: boolean; files: FileEntry[]; error?: string };
type FileApi = {
    readDirRecursive: (root: string, depth: number, allFiles: boolean) => Promise<FileResult>;
    onDirChanged?: (callback: (event: { dirPath: string }) => void) => () => void;
};

export function createWorkspaceCompletionFileCache(): {
    load: (root: string, api: FileApi) => Promise<FileEntry[]>;
    clear: () => void;
} {
    let entry: { root: string; api: FileApi; files: Promise<FileEntry[]>; expires: number } | undefined;
    let unsubscribe: (() => void) | undefined;
    const clear = (): void => {
        entry = undefined;
        unsubscribe?.();
        unsubscribe = undefined;
    };
    return {
        clear,
        load: (root, api) => {
            if (entry?.root === root && entry.api === api && entry.expires > Date.now()) return entry.files;
            clear();
            const current = {
                root,
                api,
                expires: Infinity,
                files: Promise.resolve().then(async () => {
                    const result = await api.readDirRecursive(root, Number.MAX_SAFE_INTEGER, true);
                    if (!result.success) throw new Error(result.error || "Unable to load workspace files");
                    if (entry === current) current.expires = Date.now() + 30_000;
                    return result.files;
                }),
            };
            entry = current;
            unsubscribe = api.onDirChanged?.(() => {
                if (entry === current) clear();
            });
            void current.files.catch(() => {
                if (entry === current) clear();
            });
            return current.files;
        },
    };
}

export const workspaceCompletionFiles = createWorkspaceCompletionFileCache();
