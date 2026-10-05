import { useEffect, useState } from "react";
import { isExternalAssetSrc, resolveLocalAssetCandidates } from "@/lib/attachment-paths";
import { isElectron } from "@/lib/is-electron";
import { globalState } from "@/store/global.store";

export function useLocalAsset(src: string, mimeMap: Record<string, string> | string) {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const isLocalAsset = Boolean(isElectron() && src && !isExternalAssetSrc(src));

    useEffect(() => {
        if (!isElectron() || !src || isExternalAssetSrc(src)) {
            setObjectUrl(null);
            setLoading(false);
            return;
        }

        const projectDir = globalState().directory;
        if (!projectDir) {
            setLoading(false);
            return;
        }

        let isMounted = true;
        let currentUrl: string | null = null;

        const loadAsset = async () => {
            try {
                setLoading(true);
                const candidates = resolveLocalAssetCandidates({
                    src,
                    projectDir,
                    noteFilePath: globalState().note?.filePath,
                });

                let result: Awaited<ReturnType<typeof window.electronAPI.fs.readBinaryFile>> | null = null;
                for (const candidate of candidates) {
                    result = await window.electronAPI.fs.readBinaryFile(candidate);
                    if (result?.success && result.data) break;
                }

                if (!isMounted) return;

                if (!result || result.success === false || !result.data) {
                    setError(true);
                    setLoading(false);
                    return;
                }

                const mimeType =
                    typeof mimeMap === "string"
                        ? mimeMap
                        : (mimeMap[src.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream");

                const blob = new Blob([result.data as any], { type: mimeType });
                const url = URL.createObjectURL(blob);
                currentUrl = url;
                setObjectUrl(url);
                setError(false);
            } catch (e) {
                console.error("Failed to load local asset", e);
                if (isMounted) setError(true);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadAsset();

        return () => {
            isMounted = false;
            if (currentUrl) {
                URL.revokeObjectURL(currentUrl);
            }
        };
    }, [src]);

    const displaySrc = isLocalAsset ? objectUrl : src;

    return { objectUrl, loading, error, isLocalAsset, displaySrc };
}
