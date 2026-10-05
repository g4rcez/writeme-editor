import { TerminalWindowIcon } from "@phosphor-icons/react/dist/csr/TerminalWindow";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import Convert from "ansi-to-html";
import { useMemo } from "react";
import { sanitizeAnsi } from "@/lib/encoding";

type ExecutionProps = {
    html?: string;
    output: string;
    stderr: string;
    onClose: () => void;
};

export const ExecutionOutput = ({ output, stderr, html, onClose }: ExecutionProps) => {
    const converter = useMemo(() => new Convert({ newline: true, escapeXML: true, stream: false }), []);
    if (!output && !stderr && !html) return null;
    const htmlOutput = output ? converter.toHtml(sanitizeAnsi(output)) : "";
    const htmlStderr = stderr ? converter.toHtml(sanitizeAnsi(stderr)) : "";
    return (
        <div className="border-t border-card-border bg-card-background">
            <div className="flex justify-between items-center py-1 px-3 border-b border-card-border bg-muted/30">
                <span className="flex gap-2 items-center text-xs font-medium text-muted-foreground">
                    <TerminalWindowIcon className="size-3" />
                    Output
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    title="Clear output"
                    className="p-1 rounded-md transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                    <XIcon className="size-3" />
                </button>
            </div>
            <div
                className="overflow-auto p-3 min-h-48 font-mono text-xs whitespace-pre-wrap resize-y"
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
                            if (doc) {
                                iframe.style.height = `${doc.documentElement.scrollHeight}px`;
                            }
                        }}
                    />
                )}
                {htmlOutput && <div className="text-success" dangerouslySetInnerHTML={{ __html: htmlOutput }} />}
                {htmlStderr && <div className="text-danger" dangerouslySetInnerHTML={{ __html: htmlStderr }} />}
            </div>
        </div>
    );
};
