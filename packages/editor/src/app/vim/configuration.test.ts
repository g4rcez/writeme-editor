import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { vim, Vim, getCM } from "@replit/codemirror-vim";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { SettingsSchema } from "@/store/settings.schema";
import { Neovim } from "../extensions/neovim";
import { applyCodeMirrorVimConfiguration } from "./apply-codemirror-configuration";
import { applyTiptapVimConfiguration } from "./apply-tiptap-configuration";
import { defaultVimConfiguration } from "./configuration";
import { evaluateVimConfiguration } from "./scripts/evaluate";

describe("global Vim init.ts", () => {
    it("migrates the old Markdown preference and respects an explicit shared preference", () => {
        expect(SettingsSchema.parse({ rawEditorVimMode: true }).vimMode).toBe(true);
        expect(SettingsSchema.parse({ rawEditorVimMode: true, vimMode: false }).vimMode).toBe(false);
    });

    it("evaluates typed helpers and replaces duplicate mappings", () => {
        const result = evaluateVimConfiguration(`const keys: string[] = ["Q", "Z"];
            vim.opt.leader = ",";
            for (const key of keys) vim.keymap.set("normal", key, "dw");
            vim.keymap.set("normal", "Q", "dd");
            vim.keymap.del("normal", "Z");`);
        expect(result.options.leader).toBe(",");
        expect(result.mappings).toEqual([{ mode: "normal", lhs: "Q", rhs: "dd", options: {} }]);
    });

    it("accepts a default exported setup function with type-only imports", () => {
        const result = evaluateVimConfiguration(`import type { VimConfigApi } from "@writeme/vim";
            export default (vim: VimConfigApi): void => { vim.keymap.set("insert", "jk", "<Esc>"); };`);
        expect(result.mappings[0]?.rhs).toBe("<Esc>");
    });

    it.each([
        "const value: = 1",
        "throw new Error('bad configuration')",
        "vim.opt.timeout = -1",
        "vim.keymap.set('normal', 'Q', () => 'dw')",
        "import value from 'unavailable'; vim.opt.leader = value",
        "export default async () => {}",
    ])("rejects invalid setup without applying a partial configuration: %s", (source) => {
        expect(() => evaluateVimConfiguration(source)).toThrow();
    });

    it("applies the same custom mapping to formatted and Markdown editors", () => {
        const configuration = evaluateVimConfiguration('vim.keymap.set("normal", "Q", "dw");');
        const formatted = new Editor({
            extensions: [StarterKit, Neovim.configure({ enabled: true })],
            content: "<p>one two</p>",
        });
        const cleanup = applyTiptapVimConfiguration(formatted.storage.neovim, configuration);
        const raw = new EditorView({
            parent: document.body,
            state: EditorState.create({ doc: "one two", extensions: [vim()] }),
        });
        try {
            applyCodeMirrorVimConfiguration(configuration);
            formatted.storage.neovim.feedKeys("Q");
            const cm = getCM(raw);
            if (!cm) throw new Error("CodeMirror Vim editor was not initialized");
            Vim.handleKey(cm, "Q", "user");
            expect(formatted.getText()).toBe("two");
            expect(raw.state.doc.toString()).toBe("two");
        } finally {
            cleanup();
            formatted.destroy();
            raw.destroy();
            applyCodeMirrorVimConfiguration(defaultVimConfiguration());
        }
    });

    it("removes old mappings when the global configuration is reset", () => {
        const editor = new Editor({
            extensions: [StarterKit, Neovim.configure({ enabled: true })],
            content: "<p>one two</p>",
        });
        const configuration = evaluateVimConfiguration(
            'vim.opt.leader = ","; vim.keymap.set("normal", "<leader>x", "dw");',
        );
        const cleanup = applyTiptapVimConfiguration(editor.storage.neovim, configuration);
        try {
            editor.storage.neovim.feedKeys(",x");
            expect(editor.getText()).toBe("two");
            cleanup();
            expect(editor.storage.neovim.keymap.list()).toEqual([]);
        } finally {
            editor.destroy();
        }
    });

    it("preserves an active Insert session when configuration is applied and removed", () => {
        const editor = new Editor({ extensions: [StarterKit, Neovim.configure({ enabled: true })] });
        try {
            editor.storage.neovim.setMode("insert");
            const cleanup = applyTiptapVimConfiguration(editor.storage.neovim, defaultVimConfiguration());
            expect(editor.storage.neovim.getState()?.mode).toBe("insert");
            cleanup();
            expect(editor.storage.neovim.getState()?.mode).toBe("insert");
        } finally {
            editor.destroy();
        }
    });
});
