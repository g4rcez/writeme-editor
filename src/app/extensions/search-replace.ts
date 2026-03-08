import { Extension } from "@tiptap/core";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";

export interface SearchReplaceOptions {
  searchResultClass: string;
  searchResultCurrentClass: string;
  caseSensitive: boolean;
}

export interface SearchReplaceStorage {
  searchTerm: string;
  replaceTerm: string;
  results: Array<{ from: number; to: number }>;
  resultIndex: number;
  caseSensitive: boolean;
}

const pluginKey = new PluginKey<DecorationSet>("searchReplace");

function scrollToPos(view: EditorView, pos: number): void {
  const container = document.getElementById("main-scroll-container");
  if (!container) return;
  try {
    const coords = view.coordsAtPos(pos);
    const containerRect = container.getBoundingClientRect();
    const targetScrollTop =
      container.scrollTop + coords.top - containerRect.top - containerRect.height / 3;
    container.scrollTop = Math.max(0, targetScrollTop);
  } catch {}
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatches(
  doc: ProseMirrorNode,
  searchTerm: string,
  caseSensitive: boolean,
): Array<{ from: number; to: number }> {
  if (!searchTerm) return [];
  const results: Array<{ from: number; to: number }> = [];
  const flags = caseSensitive ? "g" : "gi";
  let regex: RegExp;
  try {
    regex = new RegExp(escapeRegex(searchTerm), flags);
  } catch {
    return [];
  }
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((match = regex.exec(node.text)) !== null) {
      results.push({ from: pos + match.index, to: pos + match.index + match[0].length });
    }
  });
  return results;
}

function buildDecorations(
  doc: ProseMirrorNode,
  results: Array<{ from: number; to: number }>,
  resultIndex: number,
  searchResultClass: string,
  searchResultCurrentClass: string,
): DecorationSet {
  if (results.length === 0) return DecorationSet.empty;
  const decorations = results.map((result, i) =>
    Decoration.inline(result.from, result.to, {
      class:
        i === resultIndex
          ? `${searchResultClass} ${searchResultCurrentClass}`
          : searchResultClass,
    }),
  );
  return DecorationSet.create(doc, decorations);
}

// Helper to access typed storage without conflicting with the global Storage type
function srStorage(editor: { storage: unknown }): SearchReplaceStorage {
  return (editor.storage as Record<string, SearchReplaceStorage>)["searchReplace"]!;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchReplace: {
      setSearchTerm: (searchTerm: string) => ReturnType;
      setReplaceTerm: (replaceTerm: string) => ReturnType;
      setCaseSensitive: (caseSensitive: boolean) => ReturnType;
      nextSearchResult: () => ReturnType;
      previousSearchResult: () => ReturnType;
      replace: (replaceTerm: string) => ReturnType;
      replaceAll: (replaceTerm: string) => ReturnType;
    };
  }
}

export const SearchAndReplace = Extension.create<SearchReplaceOptions, SearchReplaceStorage>({
  name: "searchReplace",

  addOptions() {
    return {
      searchResultClass: "search-result",
      searchResultCurrentClass: "search-result-current",
      caseSensitive: false,
    };
  },

  addStorage(): SearchReplaceStorage {
    return {
      searchTerm: "",
      replaceTerm: "",
      results: [],
      resultIndex: 0,
      caseSensitive: false,
    };
  },

  addCommands() {
    return {
      setSearchTerm:
        (searchTerm: string) =>
        ({ editor }) => {
          const s = srStorage(editor);
          s.searchTerm = searchTerm;
          s.resultIndex = 0;
          s.results = findMatches(editor.state.doc, searchTerm, s.caseSensitive);
          editor.view.dispatch(editor.state.tr.setMeta(pluginKey, { forceUpdate: true }));
          const first = s.results[0];
          if (first) {
            const selTr = editor.state.tr.setSelection(
              TextSelection.create(editor.state.doc, first.from, first.to)
            );
            editor.view.dispatch(selTr);
            requestAnimationFrame(() => scrollToPos(editor.view, first.from));
          }
          return true;
        },
      setReplaceTerm:
        (replaceTerm: string) =>
        ({ editor }) => {
          srStorage(editor).replaceTerm = replaceTerm;
          return true;
        },
      setCaseSensitive:
        (caseSensitive: boolean) =>
        ({ editor }) => {
          const s = srStorage(editor);
          s.caseSensitive = caseSensitive;
          s.resultIndex = 0;
          s.results = findMatches(editor.state.doc, s.searchTerm, caseSensitive);
          editor.view.dispatch(editor.state.tr.setMeta(pluginKey, { forceUpdate: true }));
          const first = s.results[0];
          if (first) {
            const selTr = editor.state.tr.setSelection(
              TextSelection.create(editor.state.doc, first.from, first.to)
            );
            editor.view.dispatch(selTr);
            requestAnimationFrame(() => scrollToPos(editor.view, first.from));
          }
          return true;
        },
      nextSearchResult:
        () =>
        ({ editor }) => {
          const s = srStorage(editor);
          if (s.results.length === 0) return false;
          s.resultIndex = (s.resultIndex + 1) % s.results.length;
          editor.view.dispatch(editor.state.tr.setMeta(pluginKey, { forceUpdate: true }));
          const current = s.results[s.resultIndex];
          if (current) {
            const selTr = editor.state.tr.setSelection(
              TextSelection.create(editor.state.doc, current.from, current.to)
            );
            editor.view.dispatch(selTr);
            requestAnimationFrame(() => scrollToPos(editor.view, current.from));
          }
          return true;
        },
      previousSearchResult:
        () =>
        ({ editor }) => {
          const s = srStorage(editor);
          if (s.results.length === 0) return false;
          s.resultIndex = (s.resultIndex - 1 + s.results.length) % s.results.length;
          editor.view.dispatch(editor.state.tr.setMeta(pluginKey, { forceUpdate: true }));
          const current = s.results[s.resultIndex];
          if (current) {
            const selTr = editor.state.tr.setSelection(
              TextSelection.create(editor.state.doc, current.from, current.to)
            );
            editor.view.dispatch(selTr);
            requestAnimationFrame(() => scrollToPos(editor.view, current.from));
          }
          return true;
        },
      replace:
        (replaceTerm: string) =>
        ({ editor }) => {
          const s = srStorage(editor);
          if (s.results.length === 0) return false;
          const current = s.results[s.resultIndex];
          if (!current) return false;
          editor
            .chain()
            .setTextSelection({ from: current.from, to: current.to })
            .insertContent(replaceTerm)
            .run();
          s.results = findMatches(editor.state.doc, s.searchTerm, s.caseSensitive);
          s.resultIndex = Math.min(s.resultIndex, Math.max(0, s.results.length - 1));
          editor.view.dispatch(editor.state.tr.setMeta(pluginKey, { forceUpdate: true }));
          return true;
        },
      replaceAll:
        (replaceTerm: string) =>
        ({ editor }) => {
          const s = srStorage(editor);
          if (!s.searchTerm) return false;
          const results = findMatches(editor.state.doc, s.searchTerm, s.caseSensitive);
          const chain = editor.chain();
          for (let i = results.length - 1; i >= 0; i--) {
            const r = results[i]!;
            chain.setTextSelection({ from: r.from, to: r.to }).insertContent(replaceTerm);
          }
          chain.run();
          s.results = [];
          s.resultIndex = 0;
          editor.view.dispatch(editor.state.tr.setMeta(pluginKey, { forceUpdate: true }));
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init(_config: any, state: EditorState) {
            return buildDecorations(
              state.doc,
              [],
              0,
              extension.options.searchResultClass,
              extension.options.searchResultCurrentClass,
            );
          },
          apply(tr, oldSet, _oldState: EditorState, newState: EditorState) {
            const meta = tr.getMeta(pluginKey);
            if (meta?.forceUpdate) {
              const s = extension.storage;
              return buildDecorations(
                newState.doc,
                s.results,
                s.resultIndex,
                extension.options.searchResultClass,
                extension.options.searchResultCurrentClass,
              );
            }
            if (tr.docChanged) {
              return oldSet.map(tr.mapping, newState.doc);
            }
            return oldSet;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
