import { markdown } from "@codemirror/lang-markdown";
import {
    Compartment,
    EditorState,
    RangeSetBuilder,
    StateEffect,
    StateField,
    type Extension,
    type StateEffect as StateEffectType,
} from "@codemirror/state";
import { Decoration, EditorView, keymap, type DecorationSet } from "@codemirror/view";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";
import { vim } from "@replit/codemirror-vim";
import { vscodeKeymap } from "@replit/codemirror-vscode-keymap";
import { minimalSetup } from "codemirror";
import { useEffect, useRef } from "react";
import { editorSearchGlobalRef, type EditorSearchHandle, setEditorSearchGlobalRef } from "../editor-global-ref";
import { appDarkCodeMirrorTheme, appLightCodeMirrorTheme } from "./code-block/editor-themes.ts";

const MAIN_SCROLL_CONTAINER_ID = "main-scroll-container";
const CURSOR_SCROLL_MARGIN_PX = 96;
const setMarkdownSearchDecorations = StateEffect.define<DecorationSet>();

const markdownSearchDecorations = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(decorations, transaction) {
        const mappedDecorations = decorations.map(transaction.changes);
        for (const effect of transaction.effects) {
            if (effect.is(setMarkdownSearchDecorations)) return effect.value;
        }
        return mappedDecorations;
    },
    provide: (field) => EditorView.decorations.from(field),
});

type MarkdownMatch = { from: number; to: number };

function findMarkdownMatches(content: string, searchTerm: string, caseSensitive: boolean): MarkdownMatch[] {
    if (!searchTerm) return [];
    const source = caseSensitive ? content : content.toLocaleLowerCase();
    const needle = caseSensitive ? searchTerm : searchTerm.toLocaleLowerCase();
    const matches: MarkdownMatch[] = [];
    let from = 0;

    while (from <= source.length - needle.length) {
        const index = source.indexOf(needle, from);
        if (index === -1) break;
        matches.push({ from: index, to: index + needle.length });
        from = index + Math.max(needle.length, 1);
    }

    return matches;
}

function buildMarkdownSearchDecorations(matches: MarkdownMatch[], resultIndex: number): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    for (const [index, match] of matches.entries()) {
        builder.add(
            match.from,
            match.to,
            Decoration.mark({ class: index === resultIndex ? "cm-searchMatch-current" : "cm-searchMatch" }),
        );
    }
    return builder.finish();
}

export function createMarkdownSearchController(
    view: EditorView,
): EditorSearchHandle & { dispose: () => void; refreshDocument: () => void } {
    let searchTerm = "";
    let replaceTerm = "";
    let caseSensitive = false;
    let matches: MarkdownMatch[] = [];
    let resultIndex = 0;
    const listeners = new Set<() => void>();

    const notify = (): void => {
        for (const listener of listeners) listener();
    };

    const updateView = (selectCurrent: boolean): void => {
        const current = matches[resultIndex];
        const effects: StateEffectType<unknown>[] = [
            setMarkdownSearchDecorations.of(buildMarkdownSearchDecorations(matches, resultIndex)),
        ];
        if (selectCurrent && current) {
            effects.push(EditorView.scrollIntoView(current.from, { y: "center" }));
        }
        view.dispatch({
            effects,
            selection: selectCurrent && current ? { anchor: current.from, head: current.to } : undefined,
        });
        notify();
    };

    const refresh = (selectCurrent: boolean): void => {
        matches = findMarkdownMatches(view.state.doc.toString(), searchTerm, caseSensitive);
        resultIndex = Math.min(resultIndex, Math.max(matches.length - 1, 0));
        updateView(selectCurrent);
    };

    const controller: EditorSearchHandle & { dispose: () => void; refreshDocument: () => void } = {
        getState: () => ({
            searchTerm,
            replaceTerm,
            resultsCount: matches.length,
            resultIndex,
            caseSensitive,
        }),
        getContent: () => view.state.doc.toString(),
        setSearchTerm: (nextSearchTerm) => {
            searchTerm = nextSearchTerm;
            resultIndex = 0;
            refresh(true);
        },
        setReplaceTerm: (nextReplaceTerm) => {
            replaceTerm = nextReplaceTerm;
            notify();
        },
        setCaseSensitive: (nextCaseSensitive) => {
            caseSensitive = nextCaseSensitive;
            resultIndex = 0;
            refresh(true);
        },
        nextSearchResult: () => {
            if (matches.length === 0) return;
            resultIndex = (resultIndex + 1) % matches.length;
            updateView(true);
        },
        previousSearchResult: () => {
            if (matches.length === 0) return;
            resultIndex = (resultIndex - 1 + matches.length) % matches.length;
            updateView(true);
        },
        replace: (nextReplaceTerm) => {
            const current = matches[resultIndex];
            if (!current) return;
            view.dispatch({
                changes: { from: current.from, to: current.to, insert: nextReplaceTerm },
            });
            refresh(true);
        },
        replaceAll: (nextReplaceTerm) => {
            if (!searchTerm || matches.length === 0) return;
            view.dispatch({
                changes: matches.map((match) => ({ from: match.from, to: match.to, insert: nextReplaceTerm })),
            });
            resultIndex = 0;
            refresh(false);
        },
        focus: () => view.focus(),
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        dispose: () => {
            listeners.clear();
        },
        refreshDocument: () => refresh(false),
    };

    return controller;
}

type RawMarkdownEditorProps = {
    value: string;
    onChange: (value: string) => void;
    readonly?: boolean;
    theme: string;
    fontSize: number;
    vimMode?: boolean;
};

function getEditorTopInScrollContainer(view: EditorView, scrollContainer: HTMLElement): number {
    const containerRect = scrollContainer.getBoundingClientRect();
    const editorRect = view.scrollDOM.getBoundingClientRect();
    return scrollContainer.scrollTop + editorRect.top - containerRect.top;
}

function scrollMainContainerToCursor(view: EditorView): void {
    const scrollContainer = document.getElementById(MAIN_SCROLL_CONTAINER_ID);
    if (!scrollContainer) return;

    const cursorPosition = view.state.selection.main.head;
    const lineBlock = view.lineBlockAt(cursorPosition);
    const editorTop = getEditorTopInScrollContainer(view, scrollContainer);
    const cursorTop = editorTop + lineBlock.top - view.scrollDOM.scrollTop;
    const cursorBottom = editorTop + lineBlock.bottom - view.scrollDOM.scrollTop;
    const visibleTop = scrollContainer.scrollTop + CURSOR_SCROLL_MARGIN_PX;
    const visibleBottom = scrollContainer.scrollTop + scrollContainer.clientHeight - CURSOR_SCROLL_MARGIN_PX;

    if (cursorBottom > visibleBottom) {
        scrollContainer.scrollTop += cursorBottom - visibleBottom;
        return;
    }

    if (cursorTop < visibleTop) {
        scrollContainer.scrollTop += cursorTop - visibleTop;
    }
}

function createKeymapExtensions(vimMode: boolean): Extension[] {
    return vimMode ? [vim(), keymap.of(vscodeKeymap)] : [keymap.of(vscodeKeymap)];
}

function createRawMarkdownEditorTheme(fontSize: number) {
    return EditorView.theme({
        "&": {
            minHeight: "60vh",
            width: "100%",
            background: "transparent",
            color: "hsl(var(--foreground))",
            fontSize: `${fontSize}px`,
        },
        ".cm-content": {
            minHeight: "60vh",
            padding: "0 0 6rem",
            caretColor: "hsl(var(--foreground))",
            fontFamily:
                "'JetBrains Mono', 'FiraCode Nerd Font', 'Symbols Nerd Font', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            lineHeight: "1.7",
        },
        ".cm-line": {
            padding: "0",
        },
        ".cm-searchMatch": {
            backgroundColor: "hsla(var(--primary), 0.2)",
            borderRadius: "2px",
        },
        ".cm-searchMatch-current": {
            backgroundColor: "hsla(var(--primary), 0.45)",
            borderRadius: "2px",
            boxShadow: "0 0 0 1px hsla(var(--primary), 0.7)",
        },
        ".cm-cursor, .cm-dropCursor": {
            borderLeftColor: "hsl(var(--foreground))",
        },
        ".cm-focused": {
            outline: "none",
        },
        ".cm-scroller": {
            overflow: "visible",
            fontFamily:
                "'JetBrains Mono', 'FiraCode Nerd Font', 'Symbols Nerd Font', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        },
        ".cm-gutters": {
            backgroundColor: "transparent",
            border: "none",
            color: "hsl(var(--muted-foreground))",
        },
        ".cm-activeLine, .cm-activeLineGutter": {
            backgroundColor: "hsla(var(--muted), 0.25)",
        },
        ".cm-vim-panel": {
            borderTop: "1px solid hsl(var(--border))",
            backgroundColor: "hsl(var(--background))",
            color: "hsl(var(--foreground))",
            fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        },
        ".cm-vim-panel input": {
            backgroundColor: "transparent",
            color: "hsl(var(--foreground))",
        },
        ".cm-fat-cursor": {
            backgroundColor: "hsl(var(--foreground))",
            outline: "solid 1px hsl(var(--foreground))",
        },
        ".cm-fat-cursor .cm-cursor-primary": {
            borderLeftColor: "transparent",
        },
        ".cm-content.cm-fat-cursor": {
            caretColor: "transparent",
        },
        ".cm-indent-marker": {
            borderLeftColor: "hsla(var(--border), 0.35)",
        },
        ".cm-indent-marker-active": {
            borderLeftColor: "hsla(var(--primary), 0.55)",
        },
    });
}

export function RawMarkdownEditor({
    value,
    onChange,
    readonly = false,
    theme,
    fontSize,
    vimMode = false,
}: RawMarkdownEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const valueRef = useRef(value);
    const initialThemeRef = useRef(theme);
    const initialFontSizeRef = useRef(fontSize);
    const initialReadonlyRef = useRef(readonly);
    const initialVimModeRef = useRef(vimMode);
    const isSyncingExternalValueRef = useRef(false);
    const keymapCompartmentRef = useRef(new Compartment());
    const visualThemeCompartmentRef = useRef(new Compartment());
    const editorThemeCompartmentRef = useRef(new Compartment());
    const editableCompartmentRef = useRef(new Compartment());
    const readOnlyCompartmentRef = useRef(new Compartment());

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        if (!containerRef.current) return;

        let cursorScrollFrame: number | null = null;
        let searchController: (EditorSearchHandle & { dispose: () => void; refreshDocument: () => void }) | null = null;
        const scheduleCursorScroll = (editorView: EditorView): void => {
            if (cursorScrollFrame !== null) return;
            cursorScrollFrame = requestAnimationFrame(() => {
                cursorScrollFrame = null;
                scrollMainContainerToCursor(editorView);
            });
        };

        const isDark = initialThemeRef.current !== "light";
        const initialReadonly = initialReadonlyRef.current;
        const view = new EditorView({
            parent: containerRef.current,
            state: EditorState.create({
                doc: valueRef.current,
                extensions: [
                    keymapCompartmentRef.current.of(createKeymapExtensions(initialVimModeRef.current)),
                    minimalSetup,
                    markdown({
                        addKeymap: true,
                        completeHTMLTags: true,
                        pasteURLAsLink: true,
                    }),
                    markdownSearchDecorations,
                    EditorView.lineWrapping,
                    indentationMarkers({
                        activeThickness: 2,
                        hideFirstIndent: true,
                        markerType: "codeOnly",
                        colors: {
                            light: "hsla(var(--border), 0.35)",
                            dark: "hsla(var(--border), 0.35)",
                            activeLight: "hsla(var(--primary), 0.55)",
                            activeDark: "hsla(var(--primary), 0.55)",
                        },
                    }),
                    visualThemeCompartmentRef.current.of(isDark ? appDarkCodeMirrorTheme() : appLightCodeMirrorTheme()),
                    editorThemeCompartmentRef.current.of(createRawMarkdownEditorTheme(initialFontSizeRef.current)),
                    editableCompartmentRef.current.of(EditorView.editable.of(!initialReadonly)),
                    readOnlyCompartmentRef.current.of(EditorState.readOnly.of(initialReadonly)),
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged || update.selectionSet) {
                            scheduleCursorScroll(update.view);
                        }

                        if (!update.docChanged) return;
                        searchController?.refreshDocument();
                        if (isSyncingExternalValueRef.current) {
                            isSyncingExternalValueRef.current = false;
                            return;
                        }
                        const nextValue = update.state.doc.toString();
                        valueRef.current = nextValue;
                        onChangeRef.current(nextValue);
                    }),
                ],
            }),
        });

        viewRef.current = view;
        searchController = createMarkdownSearchController(view);
        setEditorSearchGlobalRef(searchController);
        if (!initialReadonly) {
            requestAnimationFrame(() => view.focus());
        }

        return () => {
            if (cursorScrollFrame !== null) {
                cancelAnimationFrame(cursorScrollFrame);
            }
            if (editorSearchGlobalRef.current === searchController) {
                setEditorSearchGlobalRef(null);
            }
            searchController?.dispose();
            view.destroy();
            viewRef.current = null;
        };
    }, []);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        const isDark = theme !== "light";
        view.dispatch({
            effects: [
                keymapCompartmentRef.current.reconfigure(createKeymapExtensions(vimMode)),
                visualThemeCompartmentRef.current.reconfigure(
                    isDark ? appDarkCodeMirrorTheme() : appLightCodeMirrorTheme(),
                ),
                editorThemeCompartmentRef.current.reconfigure(createRawMarkdownEditorTheme(fontSize)),
                editableCompartmentRef.current.reconfigure(EditorView.editable.of(!readonly)),
                readOnlyCompartmentRef.current.reconfigure(EditorState.readOnly.of(readonly)),
            ],
        });
    }, [fontSize, readonly, theme, vimMode]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        const currentValue = view.state.doc.toString();
        if (currentValue === value) return;
        isSyncingExternalValueRef.current = true;
        valueRef.current = value;
        view.dispatch({
            changes: { from: 0, to: currentValue.length, insert: value },
        });
    }, [value]);

    return <div ref={containerRef} className="w-full print:block" data-raw-markdown-editor="true" />;
}
