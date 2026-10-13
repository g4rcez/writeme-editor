import { acceptCompletion, autocompletion } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";
import { appDarkCodeMirrorTheme, appLightCodeMirrorTheme } from "@/app/elements/code-block/editor-themes";
import { useGlobalStore } from "@/store/global.store";
import { vimConfigurationCompletion } from "./configuration-completion";

type ConfigurationEditorProps = {
    readonly value: string;
    readonly onChange: (source: string) => void;
    readonly disabled: boolean;
    readonly invalid: boolean;
};

const layout = EditorView.theme({
    "&": { fontSize: "0.875rem" },
    ".cm-scroller": { fontFamily: "var(--font-mono)", overflow: "auto", maxHeight: "36rem" },
    ".cm-content": { minHeight: "22rem" },
    ".cm-gutters": { minHeight: "22rem" },
});

export function VimConfigurationEditor({
    value,
    onChange,
    disabled,
    invalid,
}: ConfigurationEditorProps): React.JSX.Element {
    const [global] = useGlobalStore();
    const isDark = global.theme !== "light";
    const host = useRef<HTMLDivElement>(null);
    const view = useRef<EditorView | null>(null);
    const latest = useRef({ value, onChange });
    const theme = useRef(new Compartment());
    const editable = useRef(new Compartment());
    const attributes = useRef(new Compartment());
    const syncing = useRef(false);

    useEffect(() => {
        latest.current = { value, onChange };
    }, [value, onChange]);
    useEffect(() => {
        if (!host.current) return;
        const language = javascript({ typescript: true });
        const editor = new EditorView({
            parent: host.current,
            state: EditorState.create({
                doc: latest.current.value,
                extensions: [
                    basicSetup,
                    autocompletion({ interactionDelay: 0 }),
                    EditorView.lineWrapping,
                    language,
                    language.language.data.of({ autocomplete: vimConfigurationCompletion }),
                    keymap.of([{ key: "Tab", run: acceptCompletion }]),
                    placeholder("Empty init.ts uses the default bindings."),
                    theme.current.of([]),
                    editable.current.of([]),
                    attributes.current.of([]),
                    layout,
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged && !syncing.current) latest.current.onChange(update.state.doc.toString());
                    }),
                ],
            }),
        });
        view.current = editor;
        return () => {
            editor.destroy();
            view.current = null;
        };
    }, []);
    useEffect(() => {
        view.current?.dispatch({
            effects: theme.current.reconfigure(isDark ? appDarkCodeMirrorTheme() : appLightCodeMirrorTheme()),
        });
    }, [isDark]);
    useEffect(() => {
        view.current?.dispatch({
            effects: [
                editable.current.reconfigure([EditorView.editable.of(!disabled), EditorState.readOnly.of(disabled)]),
                attributes.current.reconfigure(
                    EditorView.contentAttributes.of({
                        "aria-label": "Global init.ts",
                        "aria-describedby": invalid ? "vim-init-help vim-init-error" : "vim-init-help",
                        "aria-multiline": "true",
                        "aria-invalid": String(invalid),
                        "aria-readonly": String(disabled),
                        spellcheck: "false",
                        autocapitalize: "off",
                        autocomplete: "off",
                        role: "textbox",
                    }),
                ),
            ],
        });
    }, [disabled, invalid]);
    useEffect(() => {
        const editor = view.current;
        if (!editor || editor.state.doc.toString() === value) return;
        syncing.current = true;
        try {
            editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
        } finally {
            syncing.current = false;
        }
    }, [value]);
    return (
        <div
            ref={host}
            className="min-w-0 overflow-hidden rounded-md border border-card-border bg-card-background focus-within:ring-2 focus-within:ring-primary"
        />
    );
}
