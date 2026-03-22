import { useEffect, useState } from "react";
import { isElectron } from "@/lib/is-electron";
import { globalState } from "@/store/global.store";

export function useLocalAsset(
  src: string,
  mimeMap: Record<string, string> | string,
) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isLocalAsset = Boolean(
    isElectron() && src && src.startsWith("assets/"),
  );

  useEffect(() => {
    if (!isElectron() || !src || !src.startsWith("assets/")) {
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
        const cleanProjectDir = projectDir.replace(/\/$/, "");
        const cleanSrc = src.replace(/^\//, "");
        const fullPath = `${cleanProjectDir}/${cleanSrc}`;

        const result = await window.electronAPI.fs.readBinaryFile(fullPath);

        if (!isMounted) return;

        if (!result || result.success === false || !result.data) {
          setError(true);
          setLoading(false);
          return;
        }

        const mimeType =
          typeof mimeMap === "string"
            ? mimeMap
            : (mimeMap[src.split(".").pop()?.toLowerCase() ?? ""] ??
              "application/octet-stream");

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
