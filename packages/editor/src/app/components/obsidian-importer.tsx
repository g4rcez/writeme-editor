import { Button } from "@g4rcez/components";
import { useRef, useState } from "react";
import {
    importFileName,
    isObsidianMarkdownFile,
    isPathWithinImportRoot,
    joinImportPath,
    normalizeImportRelativePath,
} from "@/lib/obsidian-import";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Note } from "@/store/note";
import { getWorkspaceDocumentTitle } from "@/types/workspace-files";

type VaultFile = {
    name: string;
    path: string;
    relativePath: string;
};

type ImportProgress = {
    current: number;
    total: number;
    path: string;
};

type ImportSummary = {
    notes: number;
    assets: number;
    skipped: number;
    errors: string[];
};

type ObsidianImporterProps = {
    destinationDirectory: string | null;
};

function getErrorMessage(reason: unknown): string {
    return reason instanceof Error ? reason.message : String(reason);
}

export function ObsidianImporter({ destinationDirectory }: ObsidianImporterProps) {
    const [, dispatch] = useGlobalStore();
    const [progress, setProgress] = useState<ImportProgress | null>(null);
    const [summary, setSummary] = useState<ImportSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const importingRef = useRef(false);
    const importing = progress !== null;

    const importVault = async (): Promise<void> => {
        if (importingRef.current) return;
        if (!destinationDirectory?.trim()) {
            setError("Choose a notes directory before importing a vault.");
            return;
        }
        if (typeof window.electronAPI?.fs?.chooseObsidianVault !== "function") {
            setError("Obsidian import is available in the desktop app only.");
            return;
        }

        importingRef.current = true;
        setError(null);
        setSummary(null);
        setProgress({ current: 0, total: 0, path: "Choosing vault" });

        try {
            const vaultPath = await window.electronAPI.fs.chooseObsidianVault();
            if (!vaultPath) return;
            if (isPathWithinImportRoot(vaultPath, destinationDirectory)) {
                throw new Error("Choose a destination outside the Obsidian vault so the vault is not changed.");
            }

            const result = await window.electronAPI.fs.readDirRecursive(vaultPath, 32, true);
            if (!result.success) throw new Error(result.error ?? "Failed to read the Obsidian vault");

            const files = Array.isArray(result.files) ? (result.files as VaultFile[]) : [];
            const nextSummary: ImportSummary = { notes: 0, assets: 0, skipped: 0, errors: [] };
            setProgress({ current: 0, total: files.length, path: "Starting import" });

            for (const [index, file] of files.entries()) {
                const relativePath =
                    typeof file.relativePath === "string" ? normalizeImportRelativePath(file.relativePath) : null;
                const displayPath = typeof file.relativePath === "string" ? file.relativePath : "Unknown file";
                setProgress({ current: index, total: files.length, path: displayPath });
                const targetPath = relativePath ? joinImportPath(destinationDirectory, relativePath) : null;
                if (!relativePath || !targetPath) {
                    nextSummary.errors.push(`${displayPath}: invalid relative path`);
                    setProgress({ current: index + 1, total: files.length, path: displayPath });
                    continue;
                }

                try {
                    const existing = await window.electronAPI.fs.statFile(targetPath);
                    if (!existing.success) throw new Error(existing.error ?? "Could not check the destination");
                    if (existing.exists) {
                        nextSummary.skipped += 1;
                        setProgress({ current: index + 1, total: files.length, path: displayPath });
                        continue;
                    }

                    if (isObsidianMarkdownFile(relativePath)) {
                        const source = await window.electronAPI.fs.readFile(file.path);
                        if (!source.success || typeof source.content !== "string") {
                            throw new Error(source.error ?? "Could not read the note");
                        }
                        const written = await window.electronAPI.fs.writeFile(targetPath, source.content);
                        if (!written.success) throw new Error(written.error ?? "Could not write the note");

                        const note = Note.new(getWorkspaceDocumentTitle(importFileName(relativePath)), source.content);
                        note.setFilePath(
                            targetPath,
                            written.lastModified ? new Date(written.lastModified) : new Date(),
                        );
                        note.fileSize = typeof written.fileSize === "number" ? written.fileSize : source.content.length;
                        await repositories.notes.save(note);
                        nextSummary.notes += 1;
                    } else {
                        const copied = await window.electronAPI.fs.copyFile(file.path, targetPath);
                        if (!copied.success) throw new Error(copied.error ?? "Could not copy the asset");
                        nextSummary.assets += 1;
                    }
                } catch (reason) {
                    nextSummary.errors.push(`${displayPath}: ${getErrorMessage(reason)}`);
                }
                setProgress({ current: index + 1, total: files.length, path: displayPath });
            }

            dispatch.notes(await repositories.notes.getAll());
            setSummary(nextSummary);
        } catch (reason) {
            setError(getErrorMessage(reason));
        } finally {
            importingRef.current = false;
            setProgress(null);
        }
    };

    return (
        <section className="border-t border-border/30 py-5" aria-labelledby="obsidian-import-title">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-xl">
                    <h2 id="obsidian-import-title" className="text-sm font-medium text-foreground">
                        Import an Obsidian vault
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Copy Markdown notes and their assets into the current workspace. Folder structure and Obsidian
                        wikilinks stay unchanged.
                    </p>
                    <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                        Markdown is copied as-is and existing destination files are skipped. Plugin behavior and app
                        settings are not converted; the vault itself is not changed.
                    </p>
                </div>
                <Button
                    type="button"
                    size="small"
                    theme="primary"
                    disabled={importing || !destinationDirectory}
                    onClick={() => void importVault()}
                >
                    {importing ? "Importing…" : "Choose vault"}
                </Button>
            </div>

            {!destinationDirectory ? (
                <p className="mt-3 text-xs text-muted-foreground">
                    Choose a Notes Directory above to enable importing.
                </p>
            ) : null}

            {progress ? (
                <output className="mt-4 block space-y-1" aria-live="polite">
                    <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                        <span className="truncate">{progress.path}</span>
                        <span className="shrink-0">
                            {progress.current}/{progress.total}
                        </span>
                    </div>
                    <progress
                        className="h-1.5 w-full accent-primary"
                        value={progress.total === 0 ? 0 : progress.current}
                        max={Math.max(progress.total, 1)}
                    />
                </output>
            ) : null}

            {error ? (
                <p
                    className="mt-3 rounded border border-danger/40 bg-danger-subtle p-3 text-sm text-foreground"
                    role="alert"
                >
                    {error}
                </p>
            ) : null}

            {summary ? (
                <output className="mt-3 block rounded border border-border/40 bg-muted/20 p-3 text-sm">
                    <p className="text-foreground">
                        Imported {summary.notes} {summary.notes === 1 ? "note" : "notes"} and {summary.assets}{" "}
                        {summary.assets === 1 ? "asset" : "assets"}. Skipped {summary.skipped} existing files.
                    </p>
                    {summary.errors.length > 0 ? (
                        <details className="mt-2 text-xs text-muted-foreground">
                            <summary>{summary.errors.length} files could not be imported</summary>
                            <ul className="mt-1 list-disc space-y-1 pl-4">
                                {summary.errors.slice(0, 20).map((message) => (
                                    <li key={message}>{message}</li>
                                ))}
                            </ul>
                        </details>
                    ) : null}
                </output>
            ) : null}
        </section>
    );
}
