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
import { useDeferredValue, useEffect, useRef } from "react";
import {
  type BundledLanguage,
  type BundledTheme,
  type Highlighter,
  bundledLanguages,
  bundledThemes,
  createHighlighter,
} from "shiki";
import { getCurrentElementName } from "../../lib/editor-utils";

let highlighter: Highlighter | undefined;
let highlighterPromise: Promise<void> | undefined;
const loadingLanguages = new Set<BundledLanguage>();
const loadingThemes = new Set<BundledTheme>();

type HighlighterOptions = {
  themes: (BundledTheme | null | undefined)[];
  languages: (BundledLanguage | null | undefined)[];
};

// Theme mapping based on system theme
const THEME_MAP = {
  light: "catppuccin-latte" as BundledTheme,
  dark: "catppuccin-mocha" as BundledTheme,
};

/**
 * Get the appropriate theme based on current system theme
 */
export function getThemeForMode(mode: string): BundledTheme {
  return mode === "light" ? THEME_MAP.light : THEME_MAP.dark;
}

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
      langs,
      themes: ["catppuccin-mocha", "catppuccin-latte"],
    }).then((h) => {
      highlighter = h;
    });
    return highlighterPromise;
  }

  if (highlighterPromise) {
    return highlighterPromise;
  }
}

/**
 * Loads a theme if it's valid and not yet loaded.
 * @returns true or false depending on if it got loaded.
 */
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

/**
 * Loads a language if it's valid and not yet loaded
 * @returns true or false depending on if it got loaded.
 */
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

/**
 * Initializes the highlighter based on the prosemirror document,
 * with the themes and languages in the document.
 */
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
    const loader = loadHighlighter({ languages, themes });
    await loader;
  } else {
    await Promise.all([
      ...themes.flatMap((theme) => loadTheme(theme)),
      ...languages.flatMap((language) => !!language && loadLanguage(language)),
    ]);
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
  defaultTheme,
  getCurrentTheme,
}: {
  name: string;
  defaultLanguage: BundledLanguage | null | undefined;
  defaultTheme: BundledTheme;
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
        destroy() {}
        async initDecorations() {
          const doc = view.state.doc;
          const currentTheme = getCurrentTheme
            ? getCurrentTheme()
            : defaultTheme;
          await initHighlighter({
            doc,
            name,
            defaultLanguage,
            defaultTheme: currentTheme,
          });
          // Ensure both light and dark themes are loaded for theme switching
          if (getCurrentTheme) {
            await Promise.all([
              loadTheme(THEME_MAP.light),
              loadTheme(THEME_MAP.dark),
            ]);
          }
          const tr = view.state.tr.setMeta("shikiPluginForceDecoration", true);
          view.dispatch(tr);
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

          // The asynchronous nature of this is potentially prone to
          // race conditions. Imma just hope it's fine lol

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
        const currentTheme = getCurrentTheme ? getCurrentTheme() : defaultTheme;
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

        // only create code decoration when it's necessary to do so
        if (
          transaction.getMeta("shikiPluginForceDecoration") ||
          didChangeSomeCodeBlock
        ) {
          const currentTheme = getCurrentTheme
            ? getCurrentTheme()
            : defaultTheme;
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

const getAllLanguages = (): BundledLanguage[] => {
  const allLanguages = Object.keys(bundledLanguages) as BundledLanguage[];
  const otherLanguages = allLanguages.sort();
  return [...otherLanguages];
};

const LanguageSelector = (props: ReactNodeViewProps) => {
  const language = props.node.attrs.language || "plaintext";
  const code = useDeferredValue(props.node.textContent, "");

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

  return (
    <NodeViewWrapper
      as="div"
      className="overflow-hidden relative p-0 my-4 font-mono text-sm leading-snug rounded-md border border-gray-200 dark:border-gray-700"
    >
      <div className="flex justify-between items-center py-2 px-3 bg-gray-100 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex gap-2 items-center">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Language:
          </span>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="py-1 px-2 text-xs text-gray-700 bg-white rounded border border-gray-300 dark:text-gray-300 dark:bg-gray-900 dark:border-gray-600 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="plaintext">Plain Text</option>
            {getAllLanguages().map((lang) => (
              <option key={lang} value={lang}>
                {lang.charAt(0).toUpperCase() + lang.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {code.split("\n").length} lines
        </div>
      </div>
      <div className="p-4">
        <NodeViewContent className="outline-none content is-editable" />
      </div>
      {language === "mermaid" && code.trim() && (
        <div className="px-4 pb-4">
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <MermaidChart chart={code} />
          </div>
        </div>
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
      defaultTheme: getThemeForMode("dark"),
      themeAware: true,
      getCurrentTheme: undefined,
    } as CodeBlockShikiOptions;
  },
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Tab: () => {
        const name = getCurrentElementName(this.editor);
        if (name === "codeBlock")
          return this.editor.commands.insertContent("    ");
        return true;
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      ShikiPlugin({
        name: this.name,
        defaultLanguage: this.options.defaultLanguage,
        defaultTheme: this.options.defaultTheme,
        getCurrentTheme: this.options.getCurrentTheme,
      }),
    ];
  },
});
