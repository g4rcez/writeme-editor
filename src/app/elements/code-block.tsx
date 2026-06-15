import { getCurrentElementName } from "@/lib/editor-utils";
import { isElectron } from "@/lib/is-electron";
import { globalState } from "@/store/global.store";
import { findChildren } from "@tiptap/core";
import CodeBlock, { type CodeBlockOptions } from "@tiptap/extension-code-block";
import type { Node as ProsemirrorNode } from "@tiptap/pm/model";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type PluginView,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { clsx } from "clsx";
import { useMemo, type ReactNode } from "react";
import {
  bundledLanguages,
  bundledThemes,
  createHighlighter,
  type BundledLanguage,
  type BundledTheme,
  type Highlighter,
} from "shiki";
import { handlePasteImage } from "../extensions";
import { CodeBlockRenderer } from "./code-block/code-block-rendered.tsx";
import { shikiMathGrammer } from "./code-block/shiki-math-grammar";

type CustomShikiLanguage = "math";

type SupportedShikiLanguage = BundledLanguage | CustomShikiLanguage;

const CUSTOM_SHIKI_LANGUAGES: Record<
  CustomShikiLanguage,
  typeof shikiMathGrammer
> = {
  math: shikiMathGrammer,
};

function isBundledShikiLanguage(
  language: string | null | undefined,
): language is BundledLanguage {
  return !!language && language in bundledLanguages;
}

function isCustomShikiLanguage(
  language: string | null | undefined,
): language is CustomShikiLanguage {
  return !!language && language in CUSTOM_SHIKI_LANGUAGES;
}

function isLoadedLanguage(language: string): boolean {
  return highlighter?.getLoadedLanguages().includes(language) ?? false;
}

export type CodeBlockFrameProps = {
  id: string;
  lineCount: number;
  className?: string;
  footer?: ReactNode;
  header?: ReactNode;
  printContent?: string;
  children: ReactNode;
  isBodyVisible?: boolean;
  isTransparent?: boolean;
};

export const CodeBlockFrame = ({
  id,
  footer,
  header,
  printContent,
  children,
  className,
  lineCount,
  isBodyVisible = true,
  isTransparent = false,
}: CodeBlockFrameProps) => {
  const lineNumbers = useMemo(
    () =>
      Array.from({ length: lineCount }, (_, i) => <span key={i}>{i + 1}</span>),
    [lineCount],
  );
  return (
    <NodeViewWrapper
      id={id}
      as="div"
      aria-hidden={!isBodyVisible}
      data-print-fallback={printContent !== undefined ? "true" : undefined}
      className={clsx(
        "writeme-code-block-frame overflow-hidden min-w-full relative p-0 my-4 font-mono text-sm leading-snug border border-card-border",
        isTransparent ? "bg-transparent" : "bg-card-background",
        className,
      )}
    >
      {header}
      {printContent !== undefined && (
        <pre
          aria-hidden="true"
          className="writeme-code-block-print-content hidden"
        >
          <code>{printContent}</code>
        </pre>
      )}
      <div
        className={clsx(
          "writeme-code-block-body transition-opacity duration-200",
          isBodyVisible
            ? "h-auto opacity-100"
            : "h-0 opacity-0 pointer-events-none overflow-hidden",
        )}
      >
        <div className="writeme-code-block-row flex">
          <div
            aria-hidden="true"
            contentEditable={false}
            className={clsx(
              "writeme-code-block-gutter flex leading-6 flex-col py-4 px-3 text-right border-r select-none shrink-0 text-muted-foreground border-card-border",
              isTransparent ? "bg-transparent" : "bg-card-background",
            )}
          >
            {lineNumbers}
          </div>
          <div className="writeme-code-block-scroll overflow-x-auto relative p-4 w-full font-mono leading-6 whitespace-pre">
            {children}
          </div>
        </div>
      </div>
      {footer}
    </NodeViewWrapper>
  );
};

let highlighter: Highlighter | undefined;
let highlighterPromise: Promise<Highlighter | undefined> | undefined;
const loadingLanguages = new Set<SupportedShikiLanguage>();
const loadingThemes = new Set<BundledTheme>();

type HighlighterOptions = {
  themes: (BundledTheme | null | undefined)[];
  languages: (string | null | undefined)[];
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
): Promise<Highlighter | undefined> | undefined {
  if (!highlighter && !highlighterPromise) {
    const bundledLangs = opts.languages.filter(isBundledShikiLanguage);
    const customLangs = [
      ...new Set<CustomShikiLanguage>([
        ...opts.languages.filter(isCustomShikiLanguage),
        "math",
      ]),
    ].map((language) => CUSTOM_SHIKI_LANGUAGES[language]);
    highlighterPromise = createHighlighter({
      langs: [...bundledLangs, ...customLangs],
      themes: ["catppuccin-mocha", "catppuccin-latte"],
    }).then((h: Highlighter) => {
      return ((highlighter = h), h) as Highlighter | undefined;
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

export async function loadLanguage(language: string | null | undefined) {
  if (!highlighter || !language || isLoadedLanguage(language)) return false;
  if (loadingLanguages.has(language as SupportedShikiLanguage)) return false;

  if (isCustomShikiLanguage(language)) {
    loadingLanguages.add(language);
    await highlighter.loadLanguage(CUSTOM_SHIKI_LANGUAGES[language]);
    loadingLanguages.delete(language);
    return true;
  }

  if (isBundledShikiLanguage(language)) {
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

type ShikiState = {
  decorations: DecorationSet;
  visiblePositions: Set<number>;
  suspended: boolean;
};

function getDecorations({
  doc,
  name,
  defaultTheme,
  defaultLanguage,
  renderBackground = true,
  positions,
}: {
  doc: ProsemirrorNode;
  name: string;
  defaultLanguage: BundledLanguage | null | undefined;
  defaultTheme: BundledTheme;
  renderBackground?: boolean;
  positions?: Set<number>;
}) {
  const decorations: Decoration[] = [];
  const codeBlocks = findChildren(doc, (node) => node.type.name === name);
  codeBlocks.forEach((block) => {
    if (positions !== undefined && !positions.has(block.pos)) return;
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

function remapPositions(
  positions: Set<number>,
  mapping: { map(pos: number): number },
): Set<number> {
  const next = new Set<number>();
  for (const pos of positions) {
    next.add(mapping.map(pos));
  }
  return next;
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
        private debouncedCheckTimer: ReturnType<typeof setTimeout> | null =
          null;

        constructor() {
          this.initDecorations();
        }
        update() {
          if (this.debouncedCheckTimer !== null)
            clearTimeout(this.debouncedCheckTimer);
          this.debouncedCheckTimer = setTimeout(() => {
            this.debouncedCheckTimer = null;
            this.checkUndecoratedBlocks();
          }, 300);
        }
        destroy() {
          if (this.debouncedCheckTimer !== null)
            clearTimeout(this.debouncedCheckTimer);
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
      init: (): ShikiState => ({
        decorations: DecorationSet.empty,
        visiblePositions: new Set(),
        suspended: false,
      }),
      apply: (
        transaction,
        pluginState: ShikiState,
        oldState,
        newState,
      ): ShikiState => {
        const suspendMeta = transaction.getMeta("shikiSuspended");
        const isSuspended =
          suspendMeta === true
            ? true
            : suspendMeta === false
              ? false
              : pluginState.suspended;

        if (isSuspended) {
          return {
            decorations: DecorationSet.empty,
            visiblePositions: remapPositions(
              pluginState.visiblePositions,
              transaction.mapping,
            ),
            suspended: true,
          };
        }

        const highlightPos = transaction.getMeta("shikiHighlightPos") as
          | number
          | undefined;
        if (highlightPos !== undefined) {
          const newVisible = remapPositions(
            pluginState.visiblePositions,
            transaction.mapping,
          );
          newVisible.add(highlightPos);
          const currentTheme = getCurrentTheme!();
          return {
            decorations: getDecorations({
              doc: transaction.doc,
              name,
              defaultLanguage,
              defaultTheme: currentTheme,
              renderBackground,
              positions: newVisible,
            }),
            visiblePositions: newVisible,
            suspended: false,
          };
        }

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
          const remappedPositions = remapPositions(
            pluginState.visiblePositions,
            transaction.mapping,
          );
          const currentTheme = getCurrentTheme!();
          const forceAll = !!transaction.getMeta("shikiPluginForceDecoration");
          return {
            decorations: getDecorations({
              doc: transaction.doc,
              name,
              defaultLanguage,
              defaultTheme: currentTheme,
              renderBackground,
              positions: forceAll ? undefined : remappedPositions,
            }),
            visiblePositions: remappedPositions,
            suspended: false,
          };
        }

        return {
          decorations: pluginState.decorations.map(
            transaction.mapping,
            transaction.doc,
          ),
          visiblePositions: remapPositions(
            pluginState.visiblePositions,
            transaction.mapping,
          ),
          suspended: false,
        };
      },
    },

    props: {
      decorations(state) {
        return (shikiPlugin.getState(state) as ShikiState | null)?.decorations;
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

const PastePlugin = (name: string) =>
  new Plugin({
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

export const ShikiBlock = CodeBlock.extend<CodeBlockShikiOptions>({
  priority: 1000,
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockRenderer, {
      stopEvent: ({ event }) => {
        const target = event.target;
        return (
          target instanceof Element &&
          Boolean(target.closest('[data-code-mirror-editor="true"]'))
        );
      },
    });
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      title: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-title"),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.title ? { "data-title": attrs.title } : {},
      },
    };
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
    const nodeName = this.name;
    return [
      PastePlugin(nodeName),
      new Plugin({
        key: new PluginKey("codeBlockSelectAll"),
        props: {
          handleKeyDown(view, event) {
            if (!(event.key === "a" && (event.metaKey || event.ctrlKey)))
              return false;
            const { state } = view;
            const { $from } = state.selection;
            if ($from.parent.type.name !== nodeName) return false;
            event.preventDefault();
            const tr = state.tr.setSelection(
              TextSelection.create(state.doc, $from.start(), $from.end()),
            );
            view.dispatch(tr);
            return true;
          },
        },
      }),
      ...(this.parent?.() || []),
      ShikiPlugin({
        name: nodeName,
        defaultLanguage: this.options.defaultLanguage,
        getCurrentTheme: this.options.getCurrentTheme,
      }),
    ];
  },
});
