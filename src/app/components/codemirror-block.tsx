import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { catppuccinLatte } from "@catppuccin/codemirror";
import { languages } from "@codemirror/language-data";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { Copy, Check } from "lucide-react";
import { basicSetup } from "codemirror";
import { useGlobalStore } from "../../store/global.store";
import { EditorView, keymap, drawSelection } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { mathLanguage } from "../extensions/codemirror-math";
import { MathEvaluate } from "../elements/math-block";

export const CodeMirrorBlock = ({
  node,
  updateAttributes,
  editor,
  getPos,
}: NodeViewProps) => {
  const [state] = useGlobalStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const cmView = useRef<EditorView | null>(null);
  const [copied, setCopied] = useState(false);
  const themeCompartment = useRef(new Compartment());
  const languageCompartment = useRef(new Compartment());
  const nodeRef = useRef(node);
  const shouldRestoreFocus = useRef(false);

  const updateTimeout = useRef<NodeJS.Timeout>(null);
  const updatesToIgnore = useRef(0);

  nodeRef.current = node;

  const initialContent = node.textContent;

  const sortedLanguages = useMemo(() => {
    const langs = [...languages];
    if (!langs.find((l) => l.name === "Math")) {
      langs.push({
        name: "Math",
        alias: ["math"],
        extensions: ["math"],
        load: () => Promise.resolve(mathLanguage),
      } as any);
    }
    return langs.sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const loadLanguage = async (langName: string) => {
    const lowerLangName = langName.toLowerCase();
    const lang = sortedLanguages.find(
      (l) =>
        l.name.toLowerCase() === lowerLangName ||
        (l.alias && l.alias.some((a) => a.toLowerCase() === lowerLangName)),
    );
    if (lang) {
      if (cmView.current) {
        try {
          const extension = await lang.load();
          cmView.current.dispatch({
            effects: languageCompartment.current.reconfigure(extension),
          });
          if (shouldRestoreFocus.current) {
            cmView.current.focus();
            shouldRestoreFocus.current = false;
          }
        } catch (e) {
          console.error("Failed to load language:", langName, e);
        }
      }
      const langId = (lang.alias && lang.alias[0]) || lang.name.toLowerCase();
      if (langId !== node.attrs.language) {
        updateAttributes({ language: langId });
      }
    }
  };

  useEffect(() => {
    if (!editorRef.current) return;

    const initialTheme = state.theme === "dark" ? oneDark : catppuccinLatte;

    const startState = EditorState.create({
      doc: initialContent,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        languageCompartment.current.of([]),
        themeCompartment.current.of(initialTheme),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const value = update.state.doc.toString();
            if (typeof getPos === "function") {
              const currentContent = nodeRef.current.textContent;
              if (value === currentContent) return;

              // Clear existing timeout
              if (updateTimeout.current) clearTimeout(updateTimeout.current);

              // Set new timeout for Tiptap sync
              updateTimeout.current = setTimeout(() => {
                const posVal = getPos();
                if (typeof posVal !== "number") return;

                const tr = editor.state.tr;
                const from = posVal + 1;
                const to = posVal + 1 + nodeRef.current.content.size;

                // Increment lock to ignore the echo back from Tiptap
                updatesToIgnore.current++;

                tr.replaceWith(
                  from,
                  to,
                  value ? editor.schema.text(value) : [],
                );
                editor.view.dispatch(tr);
                updateTimeout.current = null;
              }, 300); // 300ms debounce
            }
          }
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });
      view.dispatch({
      effects: themeCompartment.current.reconfigure(oneDark),
    });


    cmView.current = view;
    if (typeof getPos === "function") {
      const pos = getPos();
      const { selection } = editor.state;
      if (selection.from >= pos && selection.to <= pos + node.nodeSize) {
        setTimeout(() => view.focus(), 10);
      }
    }

    // Force a measure after a slight delay to ensure layout is stable
    setTimeout(() => view.requestMeasure(), 50);

    return () => {
      view.destroy();
    };
  }, []);

  useEffect(() => {
    loadLanguage(node.attrs.language || "typescript");
  }, [node.attrs.language]);

  // useEffect(() => {
  //   if (!cmView.current) return;
  //   const theme = state.theme === "dark" ? oneDark : catppuccinLatte;
  //   cmView.current.dispatch({
  //     effects: themeCompartment.current.reconfigure(theme),
  //   });
  // }, [state.theme]);

  useEffect(() => {
    if (!cmView.current) return;
    if (updateTimeout.current) return;
    if (updatesToIgnore.current > 0) {
      updatesToIgnore.current--;
      return;
    }

    const currentContent = cmView.current.state.doc.toString();
    const newContent = node.textContent;
    if (currentContent !== newContent) {
      cmView.current.dispatch({
        changes: { from: 0, to: currentContent.length, insert: newContent },
      });
    }
  }, [node.textContent]);

  const handleCopy = async () => {
    const code = cmView.current?.state.doc.toString() || "";
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    shouldRestoreFocus.current = true;
    const selectedName = e.target.value;
    const lang = sortedLanguages.find((l) => l.name === selectedName);
    if (lang) {
      const langId = (lang.alias && lang.alias[0]) || lang.name.toLowerCase();
      updateAttributes({ language: langId });
      loadLanguage(langId);
    }
  };

  return (
    <NodeViewWrapper className="group rounded-md border border-gray-700 my-4 shadow-sm bg-card-background">
      <div className="flex justify-between items-center bg-gray-800/10 border-b border-gray-700/50 p-2">
        <select
          onChange={handleLanguageChange}
          className="bg-transparent text-xs text-gray-400 focus:text-gray-200 border-none outline-none cursor-pointer max-w-[150px]"
          value={
            sortedLanguages.find(
              (l) =>
                l.name.toLowerCase() ===
                  (node.attrs.language || "javascript").toLowerCase() ||
                (l.alias &&
                  l.alias.includes(node.attrs.language || "javascript")),
            )?.name || "JavaScript"
          }
        >
          {sortedLanguages.map((lang) => (
            <option key={lang.name} value={lang.name}>
              {lang.name}
            </option>
          ))}
        </select>
        <button
          title="Copy code"
          onClick={handleCopy}
          className="p-1 rounded-md hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <div ref={editorRef} />
      {node.attrs.language === "Math" && (
        <div className="p-4 border-t border-gray-700/50 bg-gray-800/10">
          <MathEvaluate code={node.textContent} />
        </div>
      )}
    </NodeViewWrapper>
  );
};
