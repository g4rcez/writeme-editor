import { uuid } from "@g4rcez/components";
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
import mermaid from "mermaid";
import { Fragment, useCallback, useEffect, useRef } from "react";
import {
  type BundledLanguage,
  type BundledTheme,
  type Highlighter,
  bundledLanguages,
  bundledThemes,
  createHighlighter,
} from "shiki";
import {
  getCurrentElementName,
  updateNodeContent,
} from "../../lib/editor-utils";
import { globalState } from "../../store/global.store";
import { ExcalidrawCode } from "./excalidraw";
import { MathBlock } from "./math-block";
import { shikiMathGrammer } from "./shiki-math-grammar";
import { Mermaid } from "./mermaid";

let highlighter: Highlighter | undefined;
let highlighterPromise: Promise<void> | undefined;
const loadingLanguages = new Set<BundledLanguage>();
const loadingThemes = new Set<BundledTheme>();

type HighlighterOptions = {
  themes: (BundledTheme | null | undefined)[];
  languages: (BundledLanguage | null | undefined)[];
};

const THEME_MAP = {
  dark: "catppuccin-mocha" as BundledTheme,
  light: "catppuccin-latte" as BundledTheme,
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

export function loadHighlighter(opts: HighlighterOptions) {
  if (!highlighter && !highlighterPromise) {
    const langs = opts.languages.filter(
      (lang): lang is BundledLanguage => !!lang && lang in bundledLanguages,
    );
    highlighterPromise = createHighlighter({
      langs: [...langs, shikiMathGrammer],
      themes: ["catppuccin-mocha", "catppuccin-latte"],
    }).then((h) => void (highlighter = h));
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

  const themes = [
    ...codeBlocks.map((block) => block.node.attrs.theme as BundledTheme),
    defaultTheme,
  ];
  const languages = [
    ...codeBlocks.map((block) => block.node.attrs.language as BundledLanguage),
    defaultLanguage,
  ];

  if (!highlighter) {
    try {
      const loader = loadHighlighter({ languages, themes });
      await loader;
    } catch (e) {
      console.warn("Failed to load Shiki highlighter:", e);
    }
  } else {
    try {
      await Promise.all([
        ...themes.flatMap((theme) => loadTheme(theme)),
        ...languages.flatMap(
          (language) => !!language && loadLanguage(language),
        ),
      ]);
    } catch (e) {
      console.warn("Failed to load Shiki themes/languages:", e);
    }
  }
}

/** Create code decorations for the current document */
function getDecorations({
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

    decorations.push(
      Decoration.node(block.pos, block.pos + block.node.nodeSize, {
        style: `background-color: ${themeResolved.bg}`,
      }),
    );

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
}: {
  name: string;
  defaultLanguage: BundledLanguage | null | undefined;
  getCurrentTheme?: () => BundledTheme;
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

const LanguageSelector = (props: ReactNodeViewProps) => {
  const language = props.node.attrs.language || "plaintext";
  const code = props.node.textContent.trim();

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
  };

  const onChangeDraw = useCallback((nextState: any) => {
    const pos = props.getPos();
    const targetNode = props.editor.state.doc.nodeAt(pos);
    updateNodeContent(props.editor, targetNode, nextState);
  }, []);

  return (
    <NodeViewWrapper
      as="div"
      className="overflow-hidden relative p-0 my-4 font-mono text-sm leading-snug rounded-md border border-card-border"
    >
      {language === "excalidraw" ? (
        <ExcalidrawCode code={code} onChange={onChangeDraw} />
      ) : (
        <Fragment>
          <div className="flex justify-between items-center py-2 px-3 border-b border-card-border bg-card-background">
            <div className="flex gap-2 items-center">
              <select
                value={language}
                aria-description="Language"
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="py-1 px-2 text-xs bg-transparent rounded border focus:ring-2 focus:outline-none focus:ring-primary"
              >
                <option value="plaintext">Plain Text</option>
                {getAllLanguages().map((lang) => (
                  <option key={lang} value={lang}>
                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-foreground">
              {code.split("\n").length} lines - {code.length} characters
            </div>
          </div>
          <div className="flex">
            <div
              className="flex flex-col shrink-0 text-right select-none text-muted-foreground bg-card-background border-r border-card-border py-4 px-3"
              aria-hidden="true"
            >
              {Array.from({
                length: props.node.textContent.split("\n").length,
              }).map((_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
            </div>
            <div className="p-4 font-mono w-full overflow-x-auto whitespace-pre">
              <NodeViewContent className="font-mono outline-none content is-editable code-content-renderer" />
            </div>
          </div>
          {language === "math" && code && <MathBlock code={code} />}
          {language === "mermaid" && code && (
            <div className="px-4 pb-4">
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <Mermaid chart={code} />
              </div>
            </div>
          )}
        </Fragment>
      )}
    </NodeViewWrapper>
  );
};

export const ShikiBlock = CodeBlock.extend<CodeBlockShikiOptions>({
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
      ...(this.parent?.() || []),
      ShikiPlugin({
        name: this.name,
        defaultLanguage: this.options.defaultLanguage,
        getCurrentTheme: this.options.getCurrentTheme,
      }),
    ];
  },
});
