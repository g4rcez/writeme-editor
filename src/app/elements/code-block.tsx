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
  bundledLanguages,
  type BundledTheme,
  bundledThemes,
  createHighlighter,
  type Highlighter,
} from "shiki";

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
    const themes = opts.themes.filter(
      (theme): theme is BundledTheme => !!theme && theme in bundledThemes,
    );
    const langs = opts.languages.filter(
      (lang): lang is BundledLanguage => !!lang && lang in bundledLanguages,
    );
    highlighterPromise = createHighlighter({ themes, langs }).then((h) => {
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
    let theme = block.node.attrs.theme || defaultTheme;

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
        destroy() { }
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
          // Apply decorations if:
          // selection includes named node,
          ([oldNodeName, newNodeName].includes(name) ||
            // OR transaction adds/removes named node,
            newNodes.length !== oldNodes.length ||
            // OR transaction has changes that completely encapsulte a node
            // (for example, a transaction that affects the entire document).
            // Such transactions can happen during collab syncing via y-prosemirror, for example.
            transaction.steps.some((step) => {
              // @ts-ignore
              return (
                // @ts-ignore
                step.from !== undefined &&
                // @ts-ignore
                step.to !== undefined &&
                oldNodes.some((node) => {
                  // @ts-ignore
                  return (
                    // @ts-ignore
                    node.pos >= step.from &&
                    // @ts-ignore
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

const LanguageSelector = (props: ReactNodeViewProps) => {
  const language = props.node.attrs.language;
  const code = useDeferredValue(props.node.textContent, "");

  return (
    <NodeViewWrapper
      as="div"
      className="p-4 my-4 font-mono text-sm leading-snug rounded"
    >
      <NodeViewContent className="content is-editable" />
      {language === "mermaid" ? <MermaidChart chart={code} /> : null}
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
