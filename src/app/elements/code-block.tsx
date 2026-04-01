import { getCurrentElementName, updateNodeContent } from "@/lib/editor-utils";
import { EXECUTION_CONFIG } from "@/lib/execution-config";
import { isElectron } from "@/lib/is-electron";
import { globalState } from "@/store/global.store";
import { Select, Button } from "@g4rcez/components";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { MagicWandIcon } from "@phosphor-icons/react/dist/csr/MagicWand";
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { TerminalWindowIcon } from "@phosphor-icons/react/dist/csr/TerminalWindow";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
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
import Convert from "ansi-to-html";
import { clsx } from "clsx";
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
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
import { canFormat, formatCode } from "./code-block-formatting";
import { ExcalidrawCode } from "./excalidraw";
import { FreehandCode } from "./freehand";
import { Flowchart } from "./flowchart";
import { Graphviz } from "./graphviz";
import { MathBlock } from "./math-block";
import { Mermaid } from "./mermaid";
import { LatexBlock } from "./latex-block";
import { handlePasteImage } from "../extensions";
import { shikiMathGrammer } from "./shiki-math-grammar";
import { sanitizeAnsi } from "@/lib/encoding";

export type CodeBlockFrameProps = {
  id: string;
  lineCount: number;
  className?: string;
  footer?: ReactNode;
  header?: ReactNode;
  children: ReactNode;
  isBodyVisible?: boolean;
  isTransparent?: boolean;
};

export const CodeBlockFrame = ({
  id,
  footer,
  header,
  children,
  className,
  lineCount,
  isBodyVisible = true,
  isTransparent = false,
}: CodeBlockFrameProps) => {
  return (
    <NodeViewWrapper
      id={id}
      as="div"
      aria-hidden={!isBodyVisible}
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
              "flex leading-6 flex-col py-4 px-3 text-right border-r select-none shrink-0 text-muted-foreground border-card-border",
              isTransparent ? "bg-transparent" : "bg-card-background",
            )}
            aria-hidden="true"
          >
            {Array.from({ length: lineCount }).map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
          <div className="overflow-x-auto relative p-4 w-full font-mono leading-6 whitespace-pre">
            {children}
          </div>
        </div>
      </div>
      {footer}
    </NodeViewWrapper>
  );
};

let highlighter: Highlighter | undefined;
let highlighterPromise: Promise<undefined> | undefined;
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

export function getShiki() {
  return highlighter;
}

export function loadHighlighter(
  opts: HighlighterOptions,
): Promise<Highlighter | undefined> {
  if (!highlighter && !highlighterPromise) {
    const langs = opts.languages.filter(
      (lang): lang is BundledLanguage => !!lang && lang in bundledLanguages,
    );
    highlighterPromise = createHighlighter({
      langs: [...langs, shikiMathGrammer],
      themes: ["catppuccin-mocha", "catppuccin-latte"],
    }).then((h: Highlighter) => {
      return ((highlighter = h), h);
    });
    return highlighterPromise;
  }
  if (highlighterPromise) {
    return highlighterPromise;
  }
  return undefined;
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
    .concat(defaultLanguage!);
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
          const currentTheme = getCurrentTheme!();
          await initHighlighter({
            doc,
            name,
            defaultLanguage,
            defaultTheme: currentTheme,
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
        const currentTheme = getCurrentTheme!();
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
          const currentTheme = getCurrentTheme!();
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

const getAllLanguages = (): string[] => {
  const allLanguages = Object.keys(bundledLanguages);
  allLanguages.push("math");
  allLanguages.push("excalidraw");
  allLanguages.push("freehand");
  allLanguages.push("graphviz");
  allLanguages.push("flowchart");
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
    <div
      contentEditable={false}
      className="flex justify-between items-center py-2 px-3 border-b border-card-border bg-card-background"
    >
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
      </div>
      <div className="text-xs text-foreground">
        {code.split("\n").length} lines - {code.length} characters
      </div>
    </div>
  );
};

type ExecutionProps = {
  output: string;
  stderr: string;
  html?: string;
  onClose: () => void;
};

const ExecutionOutput = ({ output, stderr, html, onClose }: ExecutionProps) => {
  const converter = useMemo(
    () => new Convert({ newline: true, escapeXML: true, stream: false }),
    [],
  );
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
        className="overflow-auto p-3 max-h-48 font-mono text-xs whitespace-pre-wrap"
        style={{
          fontFamily:
            "'Symbols Nerd Font', 'JetBrainsMono Nerd Font', 'FiraCode Nerd Font', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        }}
      >
        {html && (
          <iframe
            srcDoc={html}
            title="HTML Output"
            className="mb-2 w-full h-48 bg-white border border-card-border"
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
  if (language === "latex" && code) {
    return <LatexBlock code={code} />;
  }
  if (language === "mermaid" && code) {
    return (
      <div className="px-4 pb-4">
        <div className="pt-4 border-t border-card-border">
          <Mermaid chart={code} />
        </div>
      </div>
    );
  }
  if (language === "graphviz" && code) {
    return (
      <div className="px-4 pb-4">
        <div className="pt-4 border-t border-card-border">
          <Graphviz dot={code} />
        </div>
      </div>
    );
  }
  if (language === "flowchart" && code) {
    return (
      <div className="px-4 pb-4">
        <div className="pt-4 border-t border-card-border">
          <Flowchart code={code} />
        </div>
      </div>
    );
  }
  return null;
};

type OutputState = {
  stdout: string;
  stderr: string;
  html?: string;
};

const LanguageSelector = (props: ReactNodeViewProps) => {
  const id = useId();
  const language = props.node.attrs.language || "plaintext";
  const code = props.node.textContent.trim();
  const [isFormatting, setIsFormatting] = useState(false);
  const [executablePath, setExecutablePath] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<OutputState | null>(null);

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
  const canRun = !!(
    config?.browserRuntimeExec ||
    (isElectron() && executablePath)
  );

  const handleRun = async () => {
    if (!config) return;
    setIsRunning(true);
    setOutput(null);
    try {
      if (config.browserRuntimeExec && !isElectron()) {
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
    if (typeof pos !== "number") return;
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

  if (language === "freehand") {
    return (
      <NodeViewWrapper
        as="div"
        className="overflow-hidden relative p-0 my-4 font-mono text-sm leading-snug rounded-md border border-card-border"
      >
        <FreehandCode
          code={code}
          onChange={onChangeDraw}
          autoDelete={props.deleteNode}
        />
      </NodeViewWrapper>
    );
  }

  return (
    <CodeBlockFrame
      id={`code-block-${language}-${id}`}
      lineCount={props.node.textContent.split("\n").length}
      header={
        <CodeBlockHeader
          code={code}
          canRun={canRun}
          language={language}
          handleRun={handleRun}
          isRunning={isRunning}
          handleFormat={handleFormat}
          isFormatting={isFormatting}
          handleLanguageChange={handleLanguageChange}
        />
      }
      footer={
        <Fragment>
          <CodeBlockAddons language={language} code={code} />
          {output && (
            <ExecutionOutput
              html={output.html}
              output={output.stdout}
              stderr={output.stderr}
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
        if ($from.parent.type.name !== name) {
          return false;
        }
        if (isElectron()) {
          const items = event.clipboardData?.items;
          if (items) {
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              if (item?.type.startsWith("image/")) {
                handlePasteImage(view);
                return true;
              }
            }
          }
        }
        event.preventDefault();
        const text = event.clipboardData?.getData("text/plain");
        if (text) {
          const normalizedText = text.replace(/\r\n/g, "\n");
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
      themeAware: true,
      defaultLanguage: null,
      defaultTheme: getThemeForMode(globalState().theme),
      getCurrentTheme: () => {
        return getThemeForMode(globalState().theme);
      },
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
