import type { NeovimApi } from "@/app/extensions/neovim";
import type { VimConfiguration } from "./configuration";

export function applyTiptapVimConfiguration(vim: NeovimApi, configuration: VimConfiguration): () => void {
    vim.configure(configuration.options);
    const previous = vim.keymap.list();
    const bindings = configuration.mappings.flatMap((mapping) =>
        (mapping.mode === "visual" ? (["visual", "visual-line"] as const) : [mapping.mode]).map((mode) => ({
            ...mapping,
            mode,
        })),
    );
    for (const mapping of bindings) vim.keymap.set(mapping.mode, mapping.lhs, mapping.rhs, mapping.options);
    return () => {
        vim.flushPending();
        for (const mapping of bindings) vim.keymap.del(mapping.mode, mapping.lhs);
        for (const mapping of previous) vim.keymap.set(mapping.mode, mapping.keys.join(""), mapping.action, mapping);
    };
}
