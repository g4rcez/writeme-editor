import {
    snippetCompletion,
    type Completion,
    type CompletionContext,
    type CompletionResult,
} from "@codemirror/autocomplete";
import { completionPath } from "@codemirror/lang-javascript";
import { syntaxTree } from "@codemirror/language";

const members: Readonly<Record<string, readonly Completion[]>> = {
    "": [{ label: "vim", type: "variable", detail: "Global Vim configuration API" }],
    vim: [
        { label: "opt", type: "property", detail: "Shared editor options" },
        { label: "keymap", type: "property", detail: "Shared key mappings" },
    ],
    "vim.opt": [
        { label: "leader", type: "property", detail: "string", info: "Leader key, default: Space." },
        { label: "timeout", type: "property", detail: "number", info: "Mapping timeout in milliseconds (100-5000)." },
        { label: "initialMode", type: "property", detail: '"normal" | "insert"', info: "Initial editor mode." },
    ],
    "vim.keymap": [
        snippetCompletion('set("${normal}", "${lhs}", "${rhs}")', {
            label: "set",
            type: "function",
            detail: "(modes, lhs, rhs, options?)",
            info: "Map keys in normal, insert, or visual mode. Actions are Vim key sequences.",
        }),
        snippetCompletion('del("${normal}", "${lhs}")', {
            label: "del",
            type: "function",
            detail: "(modes, lhs)",
            info: "Remove a custom mapping.",
        }),
    ],
};

export function vimConfigurationCompletion(context: CompletionContext): CompletionResult | null {
    if (/Comment/.test(syntaxTree(context.state).resolveInner(context.pos, -1).name)) return null;
    const before = context.state.doc.sliceString(0, context.pos);
    const mode = /vim\.keymap\.(?:set|del)\(\s*(["'])(\w*)$/.exec(before);
    const initial = /vim\.opt\.initialMode\s*=\s*(["'])(\w*)$/.exec(before);
    const match = mode ?? initial;
    if (match)
        return {
            from: context.pos - (match[2]?.length ?? 0),
            options: (mode ? ["normal", "insert", "visual"] : ["normal", "insert"]).map((label) => ({
                label,
                type: "enum",
            })),
            validFor: /^\w*$/,
        };
    const path = completionPath(context);
    if (!path) return null;
    const options = members[path.path.join(".")];
    if (!options || (!context.explicit && !path.path.length && !path.name)) return null;
    return { from: context.pos - path.name.length, options, validFor: /^\w*$/ };
}
