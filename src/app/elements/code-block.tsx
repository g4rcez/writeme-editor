import { Button, Select, uuid } from "@g4rcez/components";
import { findChildren } from "@tiptap/core";
import CodeBlock, { type CodeBlockOptions } from "@tiptap/extension-code-block";
import { Node as ProsemirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type PluginView } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  NodeViewContent,
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { Loader2, Wand2, Play, TerminalSquare, X } from "lucide-react";
import mermaid from "mermaid";
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type BundledLanguage,
  type BundledTheme,
  type Highlighter,
  bundledLanguages,
  bundledThemes,
  createHighlighter,
} from "shiki";
import { clsx } from "clsx";
import Convert from "ansi-to-html";
import { getCurrentElementName, updateNodeContent } from "@/lib/editor-utils";
import { globalState } from "@/store/global.store";
import { canFormat, formatCode } from "./code-block-formatting";
import { ExcalidrawCode } from "./excalidraw";
import { MathBlock } from "./math-block";
import { shikiMathGrammer } from "./shiki-math-grammar";
import { Mermaid } from "./mermaid";
import { EXECUTION_CONFIG } from "@/lib/execution-config";
import { isElectron } from "@/lib/is-electron";

export type CodeBlockFrameProps = {
  children: ReactNode;
  lineCount: number;
  header?: ReactNode;
  footer?: ReactNode;
  isTransparent?: boolean;
  isBodyVisible?: boolean;
  className?: string;
};

export const CodeBlockFrame = ({
  children,
  lineCount,
  header,
  footer,
  isTransparent = false,
  isBodyVisible = true,
  className,
}: CodeBlockFrameProps) => {
  return (
    <NodeViewWrapper
      as="div"
      className={clsx(
        "overflow-hidden relative p-0 my-4 font-mono text-sm leading-snug rounded-md border border-card-border",
        isTransparent ? "bg-transparent" : "bg-card-background",
        className,
      )}
    >
      {header}
      <div
        className={clsx(
          "transition-all duration-200",
          isBodyVisible
            ? "h-auto opacity-100"
            : "h-0 opacity-0 pointer-events-none overflow-hidden",
        )}
      >
        <div className="flex">
          <div
            className={clsx(
              "flex flex-col py-4 px-3 text-right border-r select-none shrink-0 text-muted-foreground border-card-border",
              isTransparent ? "bg-transparent" : "bg-card-background",
            )}
            aria-hidden="true"
          >
            {Array.from({ length: lineCount }).map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
          <div className="overflow-x-auto relative p-4 w-full font-mono whitespace-pre">
            {children}
          </div>
        </div>
      </div>
      {footer}
    </NodeViewWrapper>
  );
};

let highlighter: Highlighter | undefined;
let highlighterPromise: Promise<void> | undefined;
const loadingLanguages = new Set<BundledLanguage>();
const loadingThemes = new Set<BundledTheme>();

type HighlighterOptions = {
  themes: (BundledTheme | null | undefined)[];
  languages: (BundledLanguage | null | undefined)[];
};

const THEME_MAP = {
  dark: "tokyo-night" as BundledTheme,
  light: "github-light" as BundledTheme,
};

export const getThemeForMode = (mode: string): BundledTheme =>
  mode === "light" ? THEME_MAP.light : THEME_MAP.dark;

export function resetHighlighter() {
  highlighter = undefined;
  highlighterPromise = undefined;
  loadingLanguages.clear();
  loadingThemes.clear();
}

export function getShiki() {
  return highlighter;
}

export function loadHighlighter(
  opts: HighlighterOptions,
): Promise<void> | undefined {
  if (!highlighter && !highlighterPromise) {
    const langs = opts.languages.filter(
      (lang): lang is BundledLanguage => !!lang && lang in bundledLanguages,
    );
    highlighterPromise = createHighlighter({
      langs: [...langs, shikiMathGrammer],
      themes: ["catppuccin-mocha", "catppuccin-latte"],
    }).then((h: Highlighter): void => {
      highlighter = h;
    });
    return highlighterPromise;
  }
  if (highlighterPromise) {
    return highlighterPromise;
  }
}

export async function loadTheme(theme: BundledTheme) {
  if (
    highlighter &&
    !highlighter.getLoadedThemes().includes(theme) &&
    !loadingThemes.has(theme) &&
    theme in bundledThemes
  ) {
    loadingThemes.add(theme);
    await highlighter.loadTheme(theme);
    loadingThemes.delete(theme);
    return true;
  }
  return false;
}

export async function loadLanguage(language: BundledLanguage) {
  if (
    highlighter &&
    !highlighter.getLoadedLanguages().includes(language) &&
    !loadingLanguages.has(language) &&
    language in bundledLanguages
  ) {
    loadingLanguages.add(language);
    await highlighter.loadLanguage(language);
    loadingLanguages.delete(language);
    return true;
  }
  return false;
}

export async function initHighlighter({
  doc,
  name,
  defaultTheme,
  defaultLanguage,
}: {
  doc: ProsemirrorNode;
  name: string;
  defaultLanguage: BundledLanguage | null | undefined;
  defaultTheme: BundledTheme;
}) {
  const codeBlocks = findChildren(doc, (node) => node.type.name === name);
  const themes = codeBlocks
    .map((block) => block.node.attrs.theme as BundledTheme)
    .concat(defaultTheme);
  const languages = codeBlocks
    .map((block) => block.node.attrs.language as BundledLanguage)
    .concat(defaultLanguage);

  if (!highlighter) {
    try {
      const loader = loadHighlighter({ languages, themes });
      await loader;
    } catch (e) {
      console.warn("Failed to load Shiki highlighter:", e);
    }
  } else {
    try {
      await Promise.all(
        themes
          .flatMap((theme) => loadTheme(theme))
          .concat(
            languages.flatMap(
              (language) => !!language && loadLanguage(language),
            ),
          ),
      );
    } catch (e) {
      console.warn("Failed to load Shiki themes/languages:", e);
    }
  }
}

function getDecorations({
  doc,
  name,
  defaultTheme,
  defaultLanguage,
  renderBackground = true,
}: {
  doc: ProsemirrorNode;
  name: string;
  defaultLanguage: BundledLanguage | null | undefined;
  defaultTheme: BundledTheme;
  renderBackground?: boolean;
}) {
  const decorations: Decoration[] = [];
  const codeBlocks = findChildren(doc, (node) => node.type.name === name);
  codeBlocks.forEach((block) => {
    let from = block.pos + 1;
    let language = block.node.attrs.language || defaultLanguage;
    const theme = block.node.attrs.theme || defaultTheme;
    const highlighter = getShiki();
    if (!highlighter) return;
    if (!highlighter.getLoadedLanguages().includes(language)) {
      language = "plaintext";
    }
    const themeToApply = highlighter.getLoadedThemes().includes(theme)
      ? theme
      : highlighter.getLoadedThemes()[0];
    const themeResolved = highlighter.getTheme(themeToApply);
    if (renderBackground) {
      decorations.push(
        Decoration.node(block.pos, block.pos + block.node.nodeSize, {
          style: `background-color: ${themeResolved.bg}`,
        }),
      );
    }
    const tokens = highlighter.codeToTokensBase(block.node.textContent, {
      lang: language,
      theme: themeToApply,
    });
    for (const line of tokens) {
      for (const token of line) {
        const to = from + token.content.length;
        const decoration = Decoration.inline(from, to, {
          style: `color: ${token.color}`,
        });
        decorations.push(decoration);
        from = to;
      }
      from += 1;
    }
  });
  return DecorationSet.create(doc, decorations);
}

export function ShikiPlugin({
  name,
  defaultLanguage,
  getCurrentTheme,
  renderBackground = true,
}: {
  name: string;
  defaultLanguage: BundledLanguage | null | undefined;
  getCurrentTheme?: () => BundledTheme;
  renderBackground?: boolean;
}) {
  const shikiPlugin: Plugin<any> = new Plugin({
    key: new PluginKey("shiki"),
    view(view) {
      class ShikiPluginView implements PluginView {
        constructor() {
          this.initDecorations();
        }
        update() {
          this.checkUndecoratedBlocks();
        }
        async initDecorations() {
          const doc = view.state.doc;
          const currentTheme = getCurrentTheme();
          await initHighlighter({
            doc,
            name,
            defaultLanguage,
            defaultTheme: currentTheme,
            // @ts-ignore
          });
          if (getCurrentTheme) {
            await Promise.all([
              loadTheme(THEME_MAP.light),
              loadTheme(THEME_MAP.dark),
            ]);
          }
          try {
            const tr = view.state.tr.setMeta(
              "shikiPluginForceDecoration",
              true,
            );
            view.dispatch(tr);
          } catch (e) {
            console.warn("[code-block]", e);
          }
        }
        async checkUndecoratedBlocks() {
          const codeBlocks = findChildren(
            view.state.doc,
            (node) => node.type.name === name,
          );
          const loadStates = await Promise.all(
            codeBlocks.flatMap((block) => [
              loadTheme(block.node.attrs.theme),
              loadLanguage(block.node.attrs.language),
            ]),
          );
          const didLoadSomething = loadStates.includes(true);
          if (didLoadSomething) {
            const tr = view.state.tr.setMeta(
              "shikiPluginForceDecoration",
              true,
            );
            view.dispatch(tr);
          }
        }
      }

      return new ShikiPluginView();
    },

    state: {
      init: (_, { doc }) => {
        const currentTheme = getCurrentTheme();
        return getDecorations({
          doc,
          name,
          defaultLanguage,
          defaultTheme: currentTheme,
          renderBackground,
          // @ts-ignore
        });
      },
      apply: (transaction, decorationSet, oldState, newState) => {
        const oldNodeName = oldState.selection.$head.parent.type.name;
        const newNodeName = newState.selection.$head.parent.type.name;
        const oldNodes = findChildren(
          oldState.doc,
          (node) => node.type.name === name,
        );
        const newNodes = findChildren(
          newState.doc,
          (node) => node.type.name === name,
        );
        const didChangeSomeCodeBlock =
          transaction.docChanged &&
          ([oldNodeName, newNodeName].includes(name) ||
            newNodes.length !== oldNodes.length ||
            transaction.steps.some((step: any) => {
              return (
                step.from !== undefined &&
                step.to !== undefined &&
                oldNodes.some((node) => {
                  return (
                    node.pos >= step.from &&
                    node.pos + node.node.nodeSize <= step.to
                  );
                })
              );
            }));
        if (
          transaction.getMeta("shikiPluginForceDecoration") ||
          didChangeSomeCodeBlock
        ) {
          const currentTheme = getCurrentTheme();
          return getDecorations({
            doc: transaction.doc,
            name,
            defaultLanguage,
            defaultTheme: currentTheme,
            renderBackground,
            // @ts-ignore
          });
        }
        return decorationSet.map(transaction.mapping, transaction.doc);
      },
    },

    props: {
      decorations(state) {
        return shikiPlugin.getState(state);
      },
    },
  });
  return shikiPlugin;
}

export interface CodeBlockShikiOptions extends CodeBlockOptions {
  defaultLanguage: BundledLanguage | null | undefined;
  defaultTheme: BundledTheme;
  themeAware?: boolean;
  getCurrentTheme?: () => BundledTheme;
}

const MermaidChart = ({ chart }: { chart: string }) => {
  const id = useRef(`chart-${uuid()}`);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      theme: "dark",
      startOnLoad: true,
      securityLevel: "loose",
      c4: {},
      darkMode: false,
    });
  }, []);

  useEffect(() => {
    if (chartRef.current && chart) {
      mermaid.render(id.current, chart).then(({ svg }) => {
        if (chartRef.current) chartRef.current.innerHTML = svg;
      });
    }
  }, [chart, id]);
  return <div ref={chartRef} />;
};

const getAllLanguages = (): string[] => {
  const allLanguages = Object.keys(bundledLanguages);
  allLanguages.push("math");
  allLanguages.push("excalidraw");
  return allLanguages.sort();
};

const CodeBlockHeader = ({
  language,
  code,
  handleLanguageChange: onChangeLanguage,
  handleFormat,
  isFormatting,
  canRun,
  handleRun,
  isRunning,
}: {
  language: string;
  code: string;
  handleLanguageChange: (lang: string) => void;
  handleFormat: () => void;
  isFormatting: boolean;
  canRun: boolean;
  handleRun: () => void;
  isRunning: boolean;
}) => {
  return (
    <div className="flex justify-between items-center py-2 px-3 border-b border-card-border bg-card-background">
      <div className="flex gap-2 items-center">
        <Select
          hiddenLabel
          value={language}
          className="h-8 text-xs"
          aria-description="Language"
          placeholder="Select a language"
          onChange={(e) => onChangeLanguage(e.target.value)}
          options={[
            { value: "plaintext", label: "Plain text" },
            ...getAllLanguages().map((lang) => ({
              value: lang,
              label: lang.charAt(0).toUpperCase() + lang.slice(1),
            })),
          ]}
        />
        {canFormat(language) && (
          <Button
            size="small"
            theme="ghost-primary"
            title="Format code"
            onClick={handleFormat}
            disabled={isFormatting}
          >
            {isFormatting ? (
              <Loader2 className="animate-spin size-4" />
            ) : (
              <span className="flex gap-1 items-center text-xs">
                <Wand2 className="size-4" />
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
              <Loader2 className="animate-spin size-4" />
            ) : (
              <span className="flex gap-1 items-center text-sm">
                <Play className="fill-current size-4" />
                Run
              </span>
            )}
          </Button>
        )}
      </div>
      <div className="text-xs text-foreground">
        {code.split("\n").length} lines - {code.length} characters
      </div>
    </div>
  );
};

const ExecutionOutput = ({
  output,
  stderr,
  html,
  onClose,
}: {
  output: string;
  stderr: string;
  html?: string;
  onClose: () => void;
}) => {
  const converter = useMemo(
    () =>
      new Convert({
        newline: true,
        escapeXML: true,
        stream: false,
      }),
    [],
  );

  if (!output && !stderr && !html) return null;

  const sanitizeAnsi = (text: string) => {
    return (
      text
        // Strip OSC escape sequences (like hyperlinks: \x1B]8;;url\x07text\x1B]8;;\x07)
        .replace(/\x1B\].*?(\x07|\x1B\\)/g, "")
        // Strip non-SGR CSI escape sequences (like cursor moves, clears, etc.)
        // but keep the SGR (color/style) sequences (\x1B[...m) for the converter.
        .replace(/\x1B\[[0-9;]*[A-GJKSTfhpqrsu]/g, "")
        // Remove Null bytes and other weird control chars except \n, \r, \t
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    );
  };

  const htmlOutput = output ? converter.toHtml(sanitizeAnsi(output)) : "";
  const htmlStderr = stderr ? converter.toHtml(sanitizeAnsi(stderr)) : "";

  return (
    <div className="border-t border-card-border bg-card-background">
      <div className="flex justify-between items-center py-1 px-3 border-b border-card-border bg-muted/30">
        <span className="flex gap-2 items-center text-xs font-medium text-muted-foreground">
          <TerminalSquare className="size-3" />
          Output
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded-md transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Clear output"
        >
          <X className="size-3" />
        </button>
      </div>
      <div
        className="overflow-auto p-3 max-h-48 font-mono text-xs whitespace-pre-wrap"
        style={{
          fontFamily:
            "'Symbols Nerd Font', 'JetBrainsMono Nerd Font', 'FiraCode Nerd Font', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        }}
      >
        {html && (
          <iframe
            srcDoc={html}
            className="mb-2 w-full h-48 bg-white border border-card-border"
            title="HTML Output"
          />
        )}
        {htmlOutput && (
          <div
            className="text-green-600 dark:text-green-400"
            dangerouslySetInnerHTML={{ __html: htmlOutput }}
          />
        )}
        {htmlStderr && (
          <div
            className="text-red-600 dark:text-red-400"
            dangerouslySetInnerHTML={{ __html: htmlStderr }}
          />
        )}
      </div>
    </div>
  );
};

const CodeBlockAddons = ({
  language,
  code,
}: {
  language: string;
  code: string;
}) => {
  if (language === "math" && code) {
    return <MathBlock code={code} />;
  }
  if (language === "mermaid" && code) {
    return (
      <div className="px-4 pb-4">
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <Mermaid chart={code} />
        </div>
      </div>
    );
  }
  return null;
};

const LanguageSelector = (props: ReactNodeViewProps) => {
  const language = props.node.attrs.language || "plaintext";
  const code = props.node.textContent.trim();
  const [isFormatting, setIsFormatting] = useState(false);
  const [executablePath, setExecutablePath] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<{
    stdout: string;
    stderr: string;
    html?: string;
  } | null>(null);

  useEffect(() => {
    if (!isElectron()) return;
    const checkExecutable = async () => {
      const config = EXECUTION_CONFIG[language as BundledLanguage];
      if (config && config.command !== "browser") {
        const path = await window.electronAPI.execution.resolve(config.command);
        setExecutablePath(path);
      } else {
        setExecutablePath(null);
      }
    };
    checkExecutable();
  }, [language]);

  const handleLanguageChange = (newLanguage: string) => {
    const { view, getPos } = props;
    const pos = getPos();
    if (typeof pos !== "number") return;
    view.dispatch(
      view.state.tr.setNodeMarkup(pos, undefined, {
        ...props.node.attrs,
        language: newLanguage,
      }),
    );
    setOutput(null);
  };

  const handleFormat = async () => {
    if (!canFormat(language)) return;
    setIsFormatting(true);
    try {
      const formatted = await formatCode(code, language);
      if (formatted === code) return;
      const pos = props.getPos();
      if (typeof pos !== "number") return;
      const targetNode = props.editor.state.doc.nodeAt(pos);
      updateNodeContent(props.editor, targetNode, formatted);
    } finally {
      setIsFormatting(false);
    }
  };

  const config = EXECUTION_CONFIG[language as BundledLanguage];
  const canRun = !!(config?.browserRuntimeExec || (isElectron() && executablePath));

  const handleRun = async () => {
    if (!config) return;

    setIsRunning(true);
    setOutput(null);
    try {
      if (config.browserRuntimeExec) {
        const result = await config.browserRuntimeExec(code);
        setOutput(result);
      } else if (isElectron() && executablePath) {
        const result = await window.electronAPI.execution.run(
          config.command,
          config.args,
          code,
        );
        setOutput({ stdout: result.stdout, stderr: result.stderr });
      }
    } catch (e) {
      setOutput({ stdout: "", stderr: `Error: ${e}` });
    } finally {
      setIsRunning(false);
    }
  };

  const onChangeDraw = useCallback((nextState: any) => {
    const pos = props.getPos();
    const targetNode = props.editor.state.doc.nodeAt(pos);
    updateNodeContent(props.editor, targetNode, nextState);
  }, []);

  if (language === "excalidraw") {
    return (
      <NodeViewWrapper
        as="div"
        className="overflow-hidden relative p-0 my-4 font-mono text-sm leading-snug rounded-md border border-card-border"
      >
        <ExcalidrawCode
          code={code}
          onChange={onChangeDraw}
          autoDelete={props.deleteNode}
        />
      </NodeViewWrapper>
    );
  }

  return (
    <CodeBlockFrame
      lineCount={props.node.textContent.split("\n").length}
      header={
        <CodeBlockHeader
          language={language}
          code={code}
          handleLanguageChange={handleLanguageChange}
          handleFormat={handleFormat}
          isFormatting={isFormatting}
          canRun={canRun}
          handleRun={handleRun}
          isRunning={isRunning}
        />
      }
      footer={
        <Fragment>
          <CodeBlockAddons language={language} code={code} />
          {output && (
            <ExecutionOutput
              output={output.stdout}
              stderr={output.stderr}
              html={output.html}
              onClose={() => setOutput(null)}
            />
          )}
        </Fragment>
      }
    >
      <NodeViewContent className="font-mono outline-none content is-editable code-content-renderer" />
    </CodeBlockFrame>
  );
};

const PastePlugin = (name: string) => {
  return new Plugin({
    key: new PluginKey("codeBlockPaste"),
    props: {
      handlePaste(view, event) {
        const { state } = view;
        const { selection } = state;
        const { $from, $to } = selection;

        // Check if cursor is inside the code block
        if ($from.parent.type.name !== name) {
          return false;
        }

        // Prevent default paste behavior
        event.preventDefault();

        // Get plain text from clipboard
        const text = event.clipboardData?.getData("text/plain");
        if (text) {
          // Normalize line endings
          const normalizedText = text.replace(/\r\n/g, "\n");

          // Insert text at current selection
          view.dispatch(
            state.tr.insertText(normalizedText, $from.pos, $to.pos),
          );
          return true;
        }

        return false;
      },
    },
  });
};

export const ShikiBlock = CodeBlock.extend<CodeBlockShikiOptions>({
  priority: 1000,
  addNodeView() {
    return ReactNodeViewRenderer(LanguageSelector);
  },
  addOptions() {
    return {
      ...this.parent?.(),
      defaultLanguage: null,
      themeAware: true,
      getCurrentTheme: () => {
        return getThemeForMode(globalState().theme);
      },
      defaultTheme: getThemeForMode(globalState().theme),
    } as CodeBlockShikiOptions;
  },
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Tab: ({ editor }) => {
        const name = getCurrentElementName(editor);
        if (name === "codeBlock") {
          return editor
            .chain()
            .focus()
            .command((args) => {
              args.tr.insertText("    ");
              return true;
            })
            .run();
        }
        return false;
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      PastePlugin(this.name),
      ...(this.parent?.() || []),
      ShikiPlugin({
        name: this.name,
        defaultLanguage: this.options.defaultLanguage,
        getCurrentTheme: this.options.getCurrentTheme,
      }),
    ];
  },
});
