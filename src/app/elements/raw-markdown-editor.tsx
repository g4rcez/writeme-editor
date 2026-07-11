import { markdown } from "@codemirror/lang-markdown";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { indentationMarkers } from "@replit/codemirror-indentation-markers";
import { vim } from "@replit/codemirror-vim";
import { vscodeKeymap } from "@replit/codemirror-vscode-keymap";
import { EditorView, minimalSetup } from "codemirror";
import { useEffect, useRef } from "react";
import { catppuccinLatte, catppuccinMocha } from "./code-block/editor-themes.ts";

type RawMarkdownEditorProps = {
    value: string;
    onChange: (value: string) => void;
    readonly?: boolean;
    theme: string;
    fontSize: number;
    vimMode?: boolean;
};

const MAIN_SCROLL_CONTAINER_ID = "main-scroll-container";
const CURSOR_SCROLL_MARGIN_PX = 96;

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
            backgroundColor: "hsl(var(--muted) / 0.25)",
        },
        ".cm-selectionBackground, .cm-content ::selection": {
            backgroundColor: "hsl(var(--primary) / 0.2)",
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
            borderLeftColor: "hsl(var(--border) / 0.35)",
        },
        ".cm-indent-marker-active": {
            borderLeftColor: "hsl(var(--primary) / 0.55)",
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
                    EditorView.lineWrapping,
                    indentationMarkers({
                        activeThickness: 2,
                        hideFirstIndent: true,
                        markerType: "codeOnly",
                        colors: {
                            light: "hsl(var(--border) / 0.35)",
                            dark: "hsl(var(--border) / 0.35)",
                            activeLight: "hsl(var(--primary) / 0.55)",
                            activeDark: "hsl(var(--primary) / 0.55)",
                        },
                    }),
                    visualThemeCompartmentRef.current.of(isDark ? catppuccinMocha() : catppuccinLatte()),
                    editorThemeCompartmentRef.current.of(createRawMarkdownEditorTheme(initialFontSizeRef.current)),
                    editableCompartmentRef.current.of(EditorView.editable.of(!initialReadonly)),
                    readOnlyCompartmentRef.current.of(EditorState.readOnly.of(initialReadonly)),
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged || update.selectionSet) {
                            scheduleCursorScroll(update.view);
                        }

                        if (!update.docChanged) return;
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
        if (!initialReadonly) {
            requestAnimationFrame(() => view.focus());
        }

        return () => {
            if (cursorScrollFrame !== null) {
                cancelAnimationFrame(cursorScrollFrame);
            }
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
                visualThemeCompartmentRef.current.reconfigure(isDark ? catppuccinMocha() : catppuccinLatte()),
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
