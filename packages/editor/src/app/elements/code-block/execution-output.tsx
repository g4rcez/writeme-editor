import { Button } from "@g4rcez/components";
import { TerminalWindowIcon } from "@phosphor-icons/react/dist/csr/TerminalWindow";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import Convert from "ansi-to-html";
import { useMemo } from "react";
import { sanitizeAnsi } from "@/lib/encoding";

type ExecutionProps = {
    html?: string;
    output: string;
    stderr: string;
    onClose?: () => void;
    onKeep?: () => void;
    onRemove?: () => void;
    keepLabel?: string;
    outdated?: boolean;
    error?: string | null;
    saved?: boolean;
    executedAt?: string;
};

export const ExecutionOutput = ({
    output,
    stderr,
    html,
    onClose,
    onKeep,
    onRemove,
    keepLabel = "Keep result",
    outdated = false,
    error,
    saved = false,
    executedAt,
}: ExecutionProps) => {
    const converter = useMemo(() => new Convert({ newline: true, escapeXML: true, stream: false }), []);
    if (!output && !stderr && !html && !saved && !onRemove && !onKeep && !error) return null;
    const htmlOutput = output ? converter.toHtml(sanitizeAnsi(output)) : "";
    const htmlStderr = stderr ? converter.toHtml(sanitizeAnsi(stderr)) : "";
    return (
        <div
            contentEditable={false}
            role="region"
            aria-label={saved ? "Kept code result" : "Execution output"}
            className="border-t border-card-border bg-card-background"
        >
            <div className="flex flex-wrap justify-between items-center gap-2 py-1 px-3 border-b border-card-border bg-muted/30">
                <span className="flex gap-2 items-center text-xs font-medium text-muted-foreground">
                    <TerminalWindowIcon className="size-3" />
                    {saved ? "Kept result" : "Output"}
                    {outdated && <span className="text-warn">Outdated</span>}
                </span>
                <div className="flex items-center gap-1">
                    {onKeep && (
                        <Button type="button" size="tiny" theme="ghost-primary" onClick={onKeep}>
                            {keepLabel}
                        </Button>
                    )}
                    {onRemove && (
                        <Button type="button" size="tiny" theme="ghost-muted" onClick={onRemove}>
                            Remove result
                        </Button>
                    )}
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            title="Clear output"
                            aria-label="Clear output"
                            className="p-1 rounded-md transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                            <XIcon className="size-3" />
                        </button>
                    )}
                </div>
            </div>
            {executedAt && (
                <p className="px-3 pt-2 text-xs text-muted-foreground">
                    Executed <time dateTime={executedAt}>{executedAt}</time>
                </p>
            )}
            {outdated && (
                <p className="px-3 pt-2 text-xs text-warn">
                    The source code or language has changed since execution. This result may be outdated.
                </p>
            )}
            {error && (
                <p role="alert" className="px-3 pt-2 text-xs text-danger">
                    {error}
                </p>
            )}
            <div
                className="overflow-auto p-3 min-h-24 font-mono text-xs whitespace-pre-wrap resize-y"
                style={{
                    fontFamily:
                        "'Symbols Nerd Font', 'JetBrainsMono Nerd Font', 'FiraCode Nerd Font', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                }}
            >
                {html && (
                    <iframe
                        srcDoc={html}
                        title="HTML Output"
                        className="mb-2 w-full bg-transparent border border-card-border"
                        onLoad={(e) => {
                            const iframe = e.currentTarget;
                            const doc = iframe.contentDocument;
                            if (doc) iframe.style.height = `${doc.documentElement.scrollHeight}px`;
                        }}
                    />
                )}
                {htmlOutput && <div className="text-success" dangerouslySetInnerHTML={{ __html: htmlOutput }} />}
                {htmlStderr && <div className="text-danger" dangerouslySetInnerHTML={{ __html: htmlStderr }} />}
            </div>
        </div>
    );
};
