import { EXECUTION_CONFIG } from "@/lib/execution-config";
import { Button, Select } from "@g4rcez/components";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { MagicWandIcon } from "@phosphor-icons/react/dist/csr/MagicWand";
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { type BundledLanguage } from "shiki";
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

export const CodeBlockHeader = ({
  language,
  code,
  title,
  handleLanguageChange: onChangeLanguage,
  handleFormat,
  isFormatting,
  canRun,
  handleRun,
  isRunning,
}: {
  language: string;
  code: string;
  title?: string | null;
  handleLanguageChange: (lang: string) => void;
  handleFormat: () => void;
  isFormatting: boolean;
  canRun: boolean;
  handleRun: () => void;
  isRunning: boolean;
}) => {
  return (
    <div
      contentEditable={false}
      className="writeme-code-block-header flex justify-between items-center py-2 px-3 border-b border-card-border bg-card-background"
    >
      <div className="flex gap-2 items-center">
        <Select
          hiddenLabel
          value={language}
          className="h-8 text-xs"
          aria-description="Language"
          placeholder="Select a language"
          onChange={(e) => onChangeLanguage(e.target.value)}
          options={LANGUAGE_OPTIONS}
        />
        {title && (
          <span
            title={title}
            className="!text-xs text-muted font-mono px-2 py-1"
          >
            {title}
          </span>
        )}
      </div>
      <div className="text-xs text-foreground flex items-center gap-2">
        {canFormat(language) && (
          <Button
            size="small"
            theme="ghost-primary"
            title="Format code"
            onClick={handleFormat}
            disabled={isFormatting}
          >
            {isFormatting ? (
              <CircleNotchIcon className="animate-spin size-4" />
            ) : (
              <span className="flex gap-1 items-center text-xs">
                <MagicWandIcon className="size-4" />
                Format
              </span>
            )}
          </Button>
        )}
        {canRun && (
          <Button
            size="small"
            onClick={handleRun}
            disabled={isRunning}
            theme="ghost-success"
            title={`Run with ${EXECUTION_CONFIG[language as BundledLanguage]?.label}`}
          >
            {isRunning ? (
              <CircleNotchIcon className="animate-spin size-4" />
            ) : (
              <span className="flex gap-1 items-center text-sm">
                <PlayIcon className="fill-current size-4" />
                Run
              </span>
            )}
          </Button>
        )}
        {code.split("\n").length} lines - {code.length} characters
      </div>
    </div>
  );
};
