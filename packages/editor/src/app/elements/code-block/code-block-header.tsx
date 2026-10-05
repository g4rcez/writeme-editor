import type { BundledLanguage } from "shiki";
import { Button } from "@g4rcez/components";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { CopyIcon } from "@phosphor-icons/react/dist/csr/Copy";
import { FileIcon } from "@phosphor-icons/react/dist/csr/File";
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
    ...SUPPORTED_LANGUAGES.map((lang): Opt => ({
        value: lang,
        label: lang.charAt(0).toUpperCase() + lang.slice(1),
    })),
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
    const languageSelect = (
        <select
            aria-label="Code language"
            value={props.language}
            onChange={(event) => {
                const selectedLanguage = event.currentTarget.value;
                props.onChangeLanguage(selectedLanguage);
            }}
            className={
                props.title
                    ? "w-fit cursor-pointer bg-transparent text-right text-xs! h-auto"
                    : "w-fit cursor-pointer bg-card-background text-right text-xs! h-auto"
            }
        >
            {LANGUAGE_OPTIONS.map((x) => (
                <option value={x.value} key={`language-select-${x.value}`}>
                    {x.label}
                </option>
            ))}
        </select>
    );

    const copyButton = (
        <Button
            size="tiny"
            onClick={props.onCopy}
            title="Copy code to clipboard"
            theme={props.isCopied ? "ghost-success" : "ghost-muted"}
        >
            <span className="flex items-center gap-1 text-xs">
                {!props.title && (props.isCopied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />)}
                {props.isCopied ? "Copied" : "Copy"}
            </span>
        </Button>
    );

    const formatButton = canFormat(props.language) ? (
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
    ) : null;

    const runButton = props.canRun ? (
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
    ) : null;

    return (
        <div
            contentEditable={false}
            className={
                props.title
                    ? "relative z-10 isolate flex min-h-12 w-full items-center justify-between gap-4 rounded-t-lg border-b border-card-border bg-secondary-background px-4 py-3"
                    : "absolute z-10 isolate top-0 right-0 flex justify-between items-center p-2 bg-card-background"
            }
        >
            {props.title && (
                <div className="flex min-w-0 items-center gap-3 text-muted-foreground">
                    <FileIcon aria-hidden="true" className="size-5 shrink-0" />
                    <span title={props.title} className="truncate font-mono text-sm">
                        {props.title}
                    </span>
                </div>
            )}
            <div className="flex shrink-0 items-center gap-2 text-xs text-foreground">
                {languageSelect}
                {props.title ? (
                    <>
                        {formatButton}
                        {runButton}
                        {copyButton}
                    </>
                ) : (
                    <>
                        {copyButton}
                        {formatButton}
                        {runButton}
                    </>
                )}
            </div>
        </div>
    );
};
