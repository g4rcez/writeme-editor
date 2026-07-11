import type { BundledLanguage } from "shiki";
import { Button } from "@g4rcez/components";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { CopyIcon } from "@phosphor-icons/react/dist/csr/Copy";
import { MagicWandIcon } from "@phosphor-icons/react/dist/csr/MagicWand";
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { EXECUTION_CONFIG } from "@/lib/execution-config";
import { canFormat } from "../code-block-formatting";

const SUPPORTED_LANGUAGES = [
    "bash",
    "c",
    "cpp",
    "css",
    "diff",
    "dockerfile",
    "go",
    "graphql",
    "html",
    "http",
    "java",
    "javascript",
    "json",
    "kotlin",
    "lua",
    "markdown",
    "mermaid",
    "php",
    "powershell",
    "prisma",
    "python",
    "ruby",
    "rust",
    "scss",
    "shell",
    "sql",
    "swift",
    "toml",
    "tsx",
    "typescript",
    "xml",
    "yaml",
    "math",
    "excalidraw",
    "freehand",
    "graphviz",
    "flowchart",
    "latex",
];

type Opt = { value: string; label: string };

const LANGUAGE_OPTIONS: Opt[] = [
    { value: "plaintext", label: "Plain text" },
    ...SUPPORTED_LANGUAGES.map(
        (lang): Opt => ({
            value: lang,
            label: lang.charAt(0).toUpperCase() + lang.slice(1),
        }),
    ),
];

type Props = {
    code: string;
    lines: number;
    canRun: boolean;
    language: string;
    isCopied: boolean;
    isRunning: boolean;
    onCopy: () => void;
    onFormat: () => void;
    handleRun: () => void;
    isFormatting: boolean;
    title?: string | null;
    onChangeLanguage: (lang: string) => void;
};

export const CodeBlockHeader = (props: Props) => {
    return (
        <div
            contentEditable={false}
            className="absolute z-10 isolate top-0 right-0 flex justify-between items-center p-2 bg-card-background"
        >
            {props.title && (
                <span title={props.title} className="text-xs! text-muted font-mono px-2 py-1">
                    {props.title}
                </span>
            )}
            <div className="text-xs text-foreground flex items-center gap-2">
                <select
                    value={props.language}
                    onChange={(e) => props.onChangeLanguage(e.target.value)}
                    className="text-right cursor-pointer text-xs! h-auto bg-card-background w-fit"
                >
                    {LANGUAGE_OPTIONS.map((x) => (
                        <option value={x.value} key={`language-select-${x.value}`}>
                            {x.label}
                        </option>
                    ))}
                </select>
                <Button
                    size="tiny"
                    onClick={props.onCopy}
                    title="Copy code to clipboard"
                    theme={props.isCopied ? "ghost-success" : "ghost-muted"}
                >
                    <span className="flex gap-1 items-center text-xs">
                        {props.isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
                        {props.isCopied ? "Copied" : "Copy"}
                    </span>
                </Button>
                {canFormat(props.language) && (
                    <Button
                        size="tiny"
                        theme="ghost-primary"
                        title="Format code"
                        onClick={props.onFormat}
                        disabled={props.isFormatting}
                    >
                        {props.isFormatting ? (
                            <CircleNotchIcon className="animate-spin size-4" />
                        ) : (
                            <span className="flex gap-1 items-center text-xs">
                                <MagicWandIcon className="size-4" />
                                Format
                            </span>
                        )}
                    </Button>
                )}
                {props.canRun && (
                    <Button
                        size="tiny"
                        theme="ghost-success"
                        onClick={props.handleRun}
                        disabled={props.isRunning}
                        title={`Run with ${EXECUTION_CONFIG[props.language as BundledLanguage]?.label}`}
                    >
                        {props.isRunning ? (
                            <CircleNotchIcon className="animate-spin size-4" />
                        ) : (
                            <span className="flex gap-2 items-center text-xs">
                                <PlayIcon className="fill-current size-4" />
                                Run
                            </span>
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
};
