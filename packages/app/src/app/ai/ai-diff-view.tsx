import { DiffView, DiffFile, DiffModeEnum } from "@git-diff-view/react";
import { useMemo } from "react";
import { globalState } from "../../store/global.store";
import { createPatch } from "diff";

export const AIDiffView = ({
  oldContent,
  newContent,
}: {
  oldContent: string;
  newContent: string;
}) => {
  const { theme } = globalState();

  const diffFile = useMemo(() => {
    try {
      const patch = createPatch("file.txt", oldContent, newContent);
      const diffList = patch.split("\n").filter((line) => {
        // Filter out header lines that createPatch adds but DiffFile might not want
        return !line.startsWith("Index: ") && !line.startsWith("==========");
      });

      return new DiffFile(
        "original.txt",
        oldContent,
        "suggested.txt",
        newContent,
        diffList,
        "markdown",
        "markdown",
      );
    } catch (e) {
      console.error("Diff generation failed:", e);
      return new DiffFile("", "", "", "", [], "markdown", "markdown");
    }
  }, [oldContent, newContent]);

  return (
    <div className="overflow-hidden overflow-y-auto max-h-96 text-xs rounded-md border border-floating-border bg-card">
      <DiffView
        diffFile={diffFile}
        diffViewMode={DiffModeEnum.Split}
        diffViewTheme={theme}
      />
    </div>
  );
};
