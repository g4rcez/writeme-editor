import {
    acceptCompletion,
    autocompletion,
    type CompletionContext,
    completionKeymap,
    completionStatus,
    type CompletionResult,
    type CompletionSource,
} from "@codemirror/autocomplete";
import { scopeCompletionSource } from "@codemirror/lang-javascript";
import { StreamLanguage } from "@codemirror/language";
import { Compartment, EditorState, Prec, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { EditorView, minimalSetup } from "codemirror";
import { useEffect, useRef } from "react";
import { appDarkCodeMirrorTheme, appLightCodeMirrorTheme } from "./editor-themes.ts";

type CodeMirrorNodeCodeEditorProps = {
    language: string;
    value: string;
    isDark: boolean;
    onChange: (nextValue: string) => void;
    onExitDown: () => void;
    onExitUp: () => void;
};

type CompletionLanguage =
    | "c"
    | "cpp"
    | "css"
    | "php"
    | "sql"
    | "tsx"
    | "xml"
    | "bash"
    | "html"
    | "http"
    | "java"
    | "json"
    | "math"
    | "rust"
    | "scss"
    | "python"
    | "markdown"
    | "javascript"
    | "typescript"
    | "yaml";

const LANGUAGE_COMPLETIONS: Record<CompletionLanguage, readonly string[]> = {
    bash: ["case", "done", "elif", "else", "export", "fi", "for", "function", "if", "then", "while"],
    c: ["#define", "#include", "const", "enum", "printf", "return", "size_t", "static", "struct", "typedef"],
    cpp: [
        "#include",
        "auto",
        "class",
        "const",
        "namespace",
        "nullptr",
        "private",
        "public",
        "std",
        "template",
        "typename",
        "vector",
    ],
    css: [
        "align-items",
        "background",
        "border",
        "color",
        "display",
        "flex",
        "font-size",
        "gap",
        "grid",
        "margin",
        "padding",
    ],
    html: ["article", "button", "div", "form", "header", "input", "label", "main", "section", "span"],
    java: [
        "class",
        "extends",
        "final",
        "implements",
        "import",
        "interface",
        "new",
        "private",
        "public",
        "return",
        "static",
        "void",
    ],
    javascript: ["await", "const", "function", "import", "let", "map", "Promise", "return", "setTimeout", "try"],
    json: ["false", "null", "true", "{}", "[]"],
    http: [
        "GET",
        "POST",
        "PATCH",
        "PUT",
        "DELETE",
        "Content-Type",
        "Authorization",
        "Cache-Control",
        "Etag",
        "Location",
    ],
    markdown: ["#", "##", "###", "-", "```", "[link](url)", "**bold**", "_italic_"],
    math: ["cos", "sin"],
    php: ["class", "echo", "extends", "function", "interface", "namespace", "private", "public", "return", "use"],
    python: ["class", "def", "elif", "else", "False", "for", "if", "import", "None", "return", "True"],
    rust: ["async", "enum", "fn", "impl", "let", "match", "mod", "mut", "pub", "struct", "trait", "use"],
    scss: [
        "@include",
        "@mixin",
        "@use",
        "$variable",
        "align-items",
        "background",
        "border",
        "color",
        "display",
        "padding",
    ],
    sql: ["DELETE", "FROM", "GROUP BY", "INSERT", "JOIN", "ORDER BY", "SELECT", "UPDATE", "VALUES", "WHERE"],
    tsx: ["Component", "JSX", "Props", "React", "useCallback", "useEffect", "useMemo", "useState"],
    typescript: ["extends", "implements", "interface", "keyof", "namespace", "never", "readonly", "type", "unknown"],
    xml: ["<?xml", "<!DOCTYPE", "<tag", "</", "/>", "xmlns"],
    yaml: ["false", "null", "true", "-", "|", ">"],
};

const COMPLETION_LANGUAGE_ALIASES: Record<string, CompletionLanguage> = {
    cc: "cpp",
    h: "c",
    hpp: "cpp",
    js: "javascript",
    jsx: "javascript",
    sh: "bash",
    shell: "bash",
    ts: "typescript",
};

const COMMON_COMPLETIONS = ["false", "null", "true"] as const;

const MATH_FUNCTIONS =
    /(?:sin|cos|tan|cot|sec|csc|asin|acos|atan|atan2|sinh|cosh|tanh|log|ln|log2|log10|exp|sqrt|cbrt|root|sum|prod|mean|median|mode|var|std|min|max|avg|floor|ceil|round|trunc|abs|sign|det|trace|rank|inv|transpose)\b/;
const MATH_CONSTANTS = /(?:pi|π|e|phi|φ|tau|τ|inf|infinity|∞|nan|NaN)\b/;
const MATH_WORD_OPERATORS = /(?:and|or|not|xor|to|in|of)\b/;

const MATH_CODE_MIRROR_LANGUAGE = StreamLanguage.define<{
    inBlockComment: boolean;
}>({
    name: "math",
    startState: () => ({ inBlockComment: false }),
    token(stream, state) {
        if (state.inBlockComment) {
            if (stream.skipTo("*/")) {
                stream.next();
                stream.next();
                state.inBlockComment = false;
            } else {
                stream.skipToEnd();
            }
            return "comment";
        }

        if (stream.eatSpace()) return null;
        if (stream.match("//")) {
            stream.skipToEnd();
            return "comment";
        }
        if (stream.match("/*")) {
            state.inBlockComment = true;
            return "comment";
        }
        if (stream.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/)) {
            return "string";
        }
        if (stream.match(/(?:0b[01]+|0o[0-7]+|0x[\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[ij]?)/)) {
            return "number";
        }
        if (stream.match(MATH_FUNCTIONS)) return "builtin";
        if (stream.match(MATH_CONSTANTS)) return "atom";
        if (stream.match(MATH_WORD_OPERATORS)) return "keyword";
        if (stream.match(/[+\-*/%^=<>!&|?:]+|[≤≥≠≈±×÷∧∨¬⊕⇒→⇔↔∀∃∄∈∉∪∩⊂⊃⊆⊇]/)) {
            return "operator";
        }
        if (stream.match(/[()[\]{},;]/)) return "bracket";
        if (stream.match(/[αβγδεζηθικλμνξοπρσςτυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ]|[a-zA-Z]\w*(?:_\w+)?/)) {
            return "variable";
        }

        stream.next();
        return null;
    },
});

function getCompletionLanguage(language: string): CompletionLanguage | null {
    const normalized = language.toLowerCase();
    if (normalized in LANGUAGE_COMPLETIONS) {
        return normalized as CompletionLanguage;
    }
    return COMPLETION_LANGUAGE_ALIASES[normalized] ?? null;
}

const browserLanguages = ["tsx", "javascript", "typescript"];

async function toCodeMirrorLanguage(language: string): Promise<Extension[]> {
    switch (getCompletionLanguage(language)) {
        case "c":
        case "cpp": {
            const { cpp } = await import("@codemirror/lang-cpp");
            return [cpp()];
        }
        case "css":
        case "scss": {
            const { css } = await import("@codemirror/lang-css");
            return [css()];
        }
        case "html": {
            const { html } = await import("@codemirror/lang-html");
            return [
                html({
                    autoCloseTags: true,
                    matchClosingTags: true,
                    selfClosingTags: true,
                }),
            ];
        }
        case "http": {
            const { http } = await import("@codemirror/legacy-modes/mode/http");
            return [StreamLanguage.define(http)];
        }
        case "java": {
            const { java } = await import("@codemirror/lang-java");
            return [java()];
        }
        case "json": {
            const { json } = await import("@codemirror/lang-json");
            return [json()];
        }
        case "markdown": {
            const { markdown } = await import("@codemirror/lang-markdown");
            return [
                markdown({
                    addKeymap: true,
                    pasteURLAsLink: true,
                    completeHTMLTags: true,
                }),
            ];
        }
        case "math":
            return [MATH_CODE_MIRROR_LANGUAGE];
        case "php": {
            const { php } = await import("@codemirror/lang-php");
            return [php()];
        }
        case "python": {
            const { python } = await import("@codemirror/lang-python");
            return [python()];
        }
        case "rust": {
            const { rust } = await import("@codemirror/lang-rust");
            return [rust()];
        }
        case "sql": {
            const { sql } = await import("@codemirror/lang-sql");
            return [sql({ upperCaseKeywords: true })];
        }
        case "tsx":
        case "javascript":
        case "typescript": {
            const { javascript } = await import("@codemirror/lang-javascript");
            return [javascript({ jsx: true, typescript: true })];
        }
        case "xml": {
            const { xml } = await import("@codemirror/lang-xml");
            return [xml({ autoCloseTags: true })];
        }
        case "yaml": {
            const { yaml } = await import("@codemirror/lang-yaml");
            return [yaml()];
        }
        default:
            return [];
    }
}

function createKeywordCompletionSource(language: string): CompletionSource {
    const completionLanguage = getCompletionLanguage(language);
    const languageCompletions = completionLanguage ? LANGUAGE_COMPLETIONS[completionLanguage] : [];
    const options = [...new Set([...COMMON_COMPLETIONS, ...languageCompletions])];
    return (context: CompletionContext): CompletionResult | null => {
        const word = context.matchBefore(/[\w.#>*-]*/);
        if (!word || (word.from === word.to && !context.explicit)) return null;
        const query = word.text.toLowerCase();
        const matches = options.filter((option) => option.toLowerCase().startsWith(query));
        if (!matches.length) {
            return null;
        }
        return {
            from: word.from,
            options: matches.map((option) => ({
                label: option,
                type: completionLanguage === "math" ? "function" : "keyword",
            })),
        };
    };
}

function isCodeMirrorSelectionAtFirstLine(view: EditorView): boolean {
    const selection = view.state.selection.main;
    if (!selection.empty) return false;
    return view.state.doc.lineAt(selection.head).number === 1;
}

function isCodeMirrorSelectionAtLastLine(view: EditorView): boolean {
    const selection = view.state.selection.main;
    if (!selection.empty) return false;
    return view.state.doc.lineAt(selection.head).number === view.state.doc.lines;
}

const CODE_MIRROR_EDITOR_THEME = EditorView.theme({
    "&": {
        color: "hsl(var(--foreground))",
        background: "transparent",
        minHeight: "100%",
        fontFamily:
            "'JetBrains Mono', 'FiraCode Nerd Font', 'Symbols Nerd Font', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    },
    ".cm-editor": {
        background: "transparent",
    },
    ".cm-content": {
        caretColor: "hsl(var(--foreground))",
        fontFamily:
            "'JetBrains Mono', 'FiraCode Nerd Font', 'Symbols Nerd Font', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        lineHeight: "1.5",
        whiteSpace: "pre",
    },
    ".cm-cursorLayer": {
        zIndex: "10",
    },
    ".cm-cursor, .cm-dropCursor": {
        borderLeft: "2px solid hsl(var(--foreground))",
    },
    ".cm-focused": {
        outline: "none",
    },
    ".cm-gutters": {
        display: "none",
    },
    ".cm-scroller": {
        fontFamily:
            "'JetBrains Mono', 'FiraCode Nerd Font', 'Symbols Nerd Font', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        maxHeight: "none",
        overflow: "auto",
        padding: "0",
    },
});

export const CodeMirrorNodeCodeEditor = ({
    language,
    value,
    isDark,
    onChange,
    onExitDown,
    onExitUp,
}: CodeMirrorNodeCodeEditorProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onExitDownRef = useRef(onExitDown);
    const onExitUpRef = useRef(onExitUp);
    const valueRef = useRef(value);
    const isSyncingExternalValueRef = useRef(false);
    const languageCompartmentRef = useRef(new Compartment());

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        onExitDownRef.current = onExitDown;
    }, [onExitDown]);

    useEffect(() => {
        onExitUpRef.current = onExitUp;
    }, [onExitUp]);

    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        if (!containerRef.current) return;
        const theme = isDark ? appDarkCodeMirrorTheme() : appLightCodeMirrorTheme();
        const autocompleteExtensions = [createKeywordCompletionSource(language)];
        if (browserLanguages.includes(language)) {
            autocompleteExtensions.push(scopeCompletionSource(window));
        }
        const view = new EditorView({
            parent: containerRef.current,
            state: EditorState.create({
                doc: valueRef.current,
                extensions: [
                    minimalSetup,
                    languageCompartmentRef.current.of([]),
                    autocompletion({ override: autocompleteExtensions }),
                    Prec.high(
                        keymap.of([
                            ...completionKeymap,
                            {
                                key: "ArrowUp",
                                run: (view) => {
                                    if (completionStatus(view.state) === "active") {
                                        return false;
                                    }
                                    if (!isCodeMirrorSelectionAtFirstLine(view)) {
                                        return false;
                                    }
                                    onExitUpRef.current();
                                    return true;
                                },
                            },
                            {
                                key: "ArrowDown",
                                run: (view) => {
                                    if (completionStatus(view.state) === "active") {
                                        return false;
                                    }
                                    if (!isCodeMirrorSelectionAtLastLine(view)) {
                                        return false;
                                    }
                                    onExitDownRef.current();
                                    return true;
                                },
                            },
                            { key: "Tab", run: acceptCompletion },
                        ]),
                    ),
                    EditorView.domEventHandlers({
                        beforeinput: (event) => {
                            event.stopPropagation();
                            return false;
                        },
                        keydown: (event) => {
                            event.stopPropagation();
                            return false;
                        },
                        mousedown: (event) => {
                            event.stopPropagation();
                            return false;
                        },
                        paste: (event) => {
                            event.stopPropagation();
                            return false;
                        },
                    }),
                    theme,
                    CODE_MIRROR_EDITOR_THEME,
                    EditorView.updateListener.of((update) => {
                        if (!update.docChanged) return;
                        if (isSyncingExternalValueRef.current) {
                            isSyncingExternalValueRef.current = false;
                            return;
                        }
                        onChangeRef.current(update.state.doc.toString());
                    }),
                ],
            }),
        });

        viewRef.current = view;
        let isCancelled = false;

        void toCodeMirrorLanguage(language).then((languageExtensions) => {
            if (isCancelled) return;
            view.dispatch({
                effects: languageCompartmentRef.current.reconfigure(languageExtensions),
            });
        });

        return () => {
            isCancelled = true;
            view.destroy();
            viewRef.current = null;
        };
    }, [language, isDark]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const focusEditor = () => {
            const view = viewRef.current;
            if (!view) return;
            requestAnimationFrame(() => view.focus());
        };

        container.addEventListener("pointerdown", focusEditor, true);
        return () => container.removeEventListener("pointerdown", focusEditor, true);
    }, []);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        const currentValue = view.state.doc.toString();
        if (currentValue === valueRef.current) return;
        isSyncingExternalValueRef.current = true;
        view.dispatch({
            changes: { from: 0, to: currentValue.length, insert: valueRef.current },
        });
    }, [value]);

    return <div ref={containerRef} contentEditable={false} className="h-full w-full" data-code-mirror-editor="true" />;
};
