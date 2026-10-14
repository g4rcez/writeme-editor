import { CompletionContext } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { vimConfigurationCompletion } from "./configuration-completion";

function labels(doc: string): readonly string[] {
    const state = EditorState.create({ doc, extensions: [javascript({ typescript: true })] });
    return (
        vimConfigurationCompletion(new CompletionContext(state, doc.length, true))?.options.map(
            (option) => option.label,
        ) ?? []
    );
}

describe("init.ts completion", () => {
    it("offers the supported API members", () => {
        expect(labels("vim.")).toEqual(["opt", "keymap"]);
        expect(labels("vim.opt.")).toEqual(["leader", "timeout", "initialMode"]);
        expect(labels("vim.keymap.")).toEqual(["set", "del"]);
    });
    it("offers the mode values accepted by each API", () => {
        expect(labels('vim.keymap.set("')).toEqual(["normal", "insert", "visual"]);
        expect(labels("vim.opt.initialMode = '")).toEqual(["normal", "insert"]);
    });
    it("keeps unsupported paths, comments, and unrelated strings free of Vim suggestions", () => {
        for (const source of ["other.opt.", '// vim.keymap.set("', "/* vim.opt.", 'const value = "vim.opt.'])
            expect(labels(source)).toEqual([]);
    });
});
