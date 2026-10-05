import { DiffView, DiffFile, DiffModeEnum } from "@git-diff-view/react";
import { createPatch } from "diff";
import { useEffect, useMemo, useState } from "react";
import { globalState } from "../../store/global.store";

const NARROW_DIFF_QUERY = "(max-width: 1279px)";

function useIsNarrowDiffViewport(): boolean {
    const [isNarrow, setIsNarrow] = useState(
        () =>
            typeof window !== "undefined" &&
            typeof window.matchMedia === "function" &&
            window.matchMedia(NARROW_DIFF_QUERY).matches,
    );

    useEffect(() => {
        if (typeof window.matchMedia !== "function") return;
        const mediaQuery = window.matchMedia(NARROW_DIFF_QUERY);
        const handleChange = (event: MediaQueryListEvent): void => setIsNarrow(event.matches);
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    return isNarrow;
}

export const AIDiffView = ({ oldContent, newContent }: { oldContent: string; newContent: string }) => {
    const { theme } = globalState();
    const isNarrow = useIsNarrowDiffViewport();

    const diffFile = useMemo(() => {
        try {
            const patch = createPatch("file.txt", oldContent, newContent);
            const diffList = [patch];

            const diffFile = new DiffFile(
                "original.txt",
                oldContent,
                "suggested.txt",
                newContent,
                diffList,
                "markdown",
                "markdown",
            );
            diffFile.init();
            diffFile.buildSplitDiffLines();
            return diffFile;
        } catch (e) {
            console.error("Diff generation failed:", e);
            return new DiffFile("", "", "", "", [], "markdown", "markdown");
        }
    }, [oldContent, newContent]);

    return (
        <div className="max-h-96 max-w-full overflow-x-auto overflow-y-auto rounded-md border border-floating-border bg-card text-xs">
            <DiffView
                diffFile={diffFile}
                diffViewMode={isNarrow ? DiffModeEnum.Unified : DiffModeEnum.Split}
                diffViewWrap
                diffViewTheme={theme === "light" ? "light" : "dark"}
            />
        </div>
    );
};
