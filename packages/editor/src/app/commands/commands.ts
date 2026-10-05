import type { EditorView } from "@tiptap/pm/view";
import type { ExtendedRegExpMatchArray } from "@tiptap/react";
import { uuid } from "@g4rcez/components";
import { type Editor, Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { INLINE_MATH_PATTERN, runInlineMath, solveRule3 } from "solver";
import { addFrontmatterToEditor } from "@/app/frontmatter";
import { Dates } from "@/lib/dates";
import { uiDispatch } from "@/store/ui.store";
import type { ReplacerHandlerParams } from "./types";
import { convertCurrency, formatConversionResult } from "../../lib/currency";
import { ClipboardCloseListenerCommand, ClipboardListenerCommand } from "./clipboard-listener.command";
import { replacerRules } from "./replace-rules";

export type ReplacerCommand = {
    trigger: string;
    description: string;
    find: RegExp;
    replace: (thing: ExtendedRegExpMatchArray, props: ReplacerHandlerParams, editor: Editor) => string;
};

export const CurrencyCommand: ReplacerCommand = {
    trigger: ">>money 10USD to EUR=",
    description: "Convert an amount between currencies.",
    find: />>money (?<from>\d+(\.\d+)?[A-Z]{3})\s+(to|in)\s+(?<to>[A-Z]{3})\s*=$/i,
    replace: (capture, _, editor) => {
        let from = capture?.groups?.from?.trim().toUpperCase();
        const to = capture?.groups?.to?.trim().toUpperCase();
        if (!from || !to) {
            return "";
        }
        const amount = from.replace(/[A-Z]{3}$/g, "");
        from = from.match(/[A-Z]{3}$/g)?.[0];
        if (!from) return "";
        convertCurrency(Number(amount), from, to).then((result) => {
            editor.chain().focus().insertContent(formatConversionResult(result)).run();
        });
        return "";
    },
};

const MathCommand: ReplacerCommand = {
    trigger: ">>math 1 + 1=",
    description: "Calculate a math expression.",
    find: INLINE_MATH_PATTERN,
    replace: (capture) => runInlineMath(capture[0]),
};

const EvalCommand: ReplacerCommand = {
    trigger: ">>eval expression;",
    description: "Evaluate a JavaScript expression.",
    find: />>eval [^;]+ ?;$/,
    replace: (capture) => {
        const expr = (capture[0].trim() || "").replace(/^>>eval /, "").trim();
        if (expr === "") return "";
        const x = eval(expr);
        return `${x}`;
    },
};

export const TimeCommand: ReplacerCommand = {
    trigger: ">>time",
    description: "Insert the current local time.",
    find: />>time $/,
    replace: (capture) => {
        const expr = (capture[0].trim() || "").replace(/^>>time /, "").trim();
        if (expr === "") return "";
        return Dates.time(new Date());
    },
};

export const DateCommand: ReplacerCommand = {
    trigger: ">>date",
    description: "Insert the current ISO date.",
    find: />>date $/,
    replace: (capture) => {
        const expr = (capture[0].trim() || "").replace(/^>>date /, "").trim();
        if (expr === "") return "";
        return Dates.isoDate(new Date());
    },
};

export const DateTimeCommand: ReplacerCommand = {
    trigger: ">>datetime",
    description: "Insert the current local date and time.",
    find: />>datetime $/,
    replace: (capture) => {
        const expr = (capture[0].trim() || "").replace(/^>>datetime /, "").trim();
        if (expr === "") return "";
        return `${Dates.isoDate(new Date())} ${Dates.time(new Date())}`;
    },
};

export const UuidCommand: ReplacerCommand = {
    trigger: ">>uuid",
    description: "Insert a UUID.",
    find: />>uuid $/,
    replace: (capture) => {
        const expr = (capture[0].trim() || "").replace(/^>>uuid /, "").trim();
        if (expr === "") return "";
        return uuid();
    },
};

export const LatexInlineCommand: ReplacerCommand = {
    trigger: ">>expr",
    description: "Open the inline math expression prompt.",
    find: />>expr $/,
    replace: (_, __, editor) => {
        uiDispatch.setPrompt({
            open: true,
            title: "Inline math block:",
            onConfirm: (latex: string) => {
                if (latex) {
                    setTimeout(() => {
                        editor.chain().focus().insertInlineMath({ latex }).run();
                    }, 100);
                }
            },
        });
        return "";
    },
};

const onlyNumbers = (x: string) => x.replace(/[^0-9]/g, "");
const FRONTMATTER_PENDING_META = "frontmatterCommandPending";
type PendingFrontmatter = { position: number };

export const FrontmatterCommand: ReplacerCommand = {
    trigger: ">>-- ",
    description: "Add frontmatter to the current note.",
    find: />>(?:--|\u2014)(?: |$)/,
    replace: (match, props, editor) => {
        if (!match[0].endsWith(" ")) {
            props.state.tr.setMeta(FRONTMATTER_PENDING_META, {
                position: props.range.from,
            } satisfies PendingFrontmatter);
        }
        setTimeout(() => {
            addFrontmatterToEditor(editor);
        }, 0);
        return "";
    },
};

export const TableCommand: ReplacerCommand = {
    trigger: ">>table(3x4)",
    description: "Insert a table with the specified columns and rows.",
    find: />>table ?\(\d+[x,]\d+\)$/,
    replace: (regex, _, editor) => {
        const coords = regex[0].match(/(\(\d+(x|,)\d+\))/)?.[0];
        const [cols, , rows] = coords?.split(/(x|,)/)?.map((x) => Number.parseInt(onlyNumbers(x))) || [3, 4];
        setTimeout(() => {
            editor.chain().focus().insertTable({ cols, rows, withHeaderRow: true }).run();
        }, 100);
        return "";
    },
};

const Rule3Command: ReplacerCommand = {
    trigger: ">>rule3(2, 4, x, 8)",
    description: "Solve a rule-of-three proportion.",
    find: />>rule3\s*\([^)]+\)$/,
    replace: (capture) => {
        const match = capture[0].trim();
        const innerMatch = match.match(/rule3\s*\(\s*([^)]+)\)/);
        if (!innerMatch) return match;
        const result = solveRule3(innerMatch[1]!);
        if (!result.ok) return match;
        return `${result.variable} = ${result.value}`;
    },
};

export const LatexInlineTransformerCommand: ReplacerCommand = {
    trigger: "$$expression$$",
    description: "Convert LaTeX text to inline math.",
    find: /\$\$[^$]+\$\$ /,
    replace: (regex, _, editor) => {
        const latex = regex[0];
        if (!latex) return "";
        setTimeout(() => {
            editor
                .chain()
                .focus()
                .insertInlineMath({
                    latex: latex.trim().replace(/^\$/, "").replace(/\$$/, ""),
                })
                .run();
        }, 100);
        return "";
    },
};

const REPLACER_COMMANDS = [
    Rule3Command,
    DateCommand,
    DateTimeCommand,
    TimeCommand,
    UuidCommand,
    EvalCommand,
    CurrencyCommand,
    MathCommand,
    FrontmatterCommand,
    TableCommand,
    LatexInlineCommand,
    ClipboardListenerCommand,
    LatexInlineTransformerCommand,
    ClipboardCloseListenerCommand,
];

export const TEXT_COMMAND_REFERENCE = REPLACER_COMMANDS.map(({ trigger, description }) => ({
    trigger,
    description,
}));

export const ReplacerCommands = Extension.create({
    name: "commands-replacer",
    addInputRules() {
        return REPLACER_COMMANDS.map((command) => replacerRules(this.editor, command));
    },
    addProseMirrorPlugins() {
        const pluginKey = new PluginKey<PendingFrontmatter | null>("frontmatterCommand");
        const clearPending = (view: EditorView): void => {
            view.dispatch(view.state.tr.setMeta(FRONTMATTER_PENDING_META, null));
        };

        return [
            new Plugin<PendingFrontmatter | null>({
                key: pluginKey,
                state: {
                    init: () => null,
                    apply: (transaction, previous) => {
                        const meta = transaction.getMeta(FRONTMATTER_PENDING_META) as
                            | PendingFrontmatter
                            | null
                            | undefined;
                        if (meta === null) return null;
                        if (meta) return { position: transaction.mapping.map(meta.position) };
                        if (!previous) return null;
                        return { position: transaction.mapping.map(previous.position) };
                    },
                },
                props: {
                    handleKeyDown: (view, event) => {
                        const pending = pluginKey.getState(view.state);
                        if (!pending) return false;

                        const { from, to } = view.state.selection;
                        if (from !== pending.position || to !== pending.position) {
                            clearPending(view);
                            return false;
                        }

                        if (event.key !== " ") {
                            clearPending(view);
                            return false;
                        }

                        event.preventDefault();
                        clearPending(view);
                        return true;
                    },
                    handleTextInput: (view, from, to, text) => {
                        const pending = pluginKey.getState(view.state);
                        if (!pending) return false;

                        if (from !== pending.position || to !== pending.position) {
                            clearPending(view);
                            return false;
                        }

                        clearPending(view);
                        return text === " ";
                    },
                },
            }),
        ];
    },
});
