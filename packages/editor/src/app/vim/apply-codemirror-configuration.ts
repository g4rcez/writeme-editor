import { Vim } from "@replit/codemirror-vim";
import { parseKeys } from "@/app/extensions/neovim/keymap";
import type { VimConfiguration } from "./configuration";

let previous: VimConfiguration | undefined;

export function applyCodeMirrorVimConfiguration(configuration: VimConfiguration): void {
    if (previous === configuration) return;
    const expand = (keys: string, leader: string): string =>
        parseKeys(keys, leader).join("").replaceAll(" ", "<Space>");
    for (const mapping of previous?.mappings ?? [])
        Vim.unmap(expand(mapping.lhs, previous?.options.leader ?? " "), mapping.mode);
    Vim.map("<C-w>", "dw", "normal");
    Vim.map("<C-w>", "d", "visual");
    for (const mapping of configuration.mappings) {
        const lhs = expand(mapping.lhs, configuration.options.leader);
        const rhs = expand(mapping.rhs, configuration.options.leader);
        if (mapping.options.remap) Vim.map(lhs, rhs, mapping.mode);
        else Vim.noremap(lhs, rhs, mapping.mode);
    }
    Vim.setOption("insertModeEscKeysTimeout", configuration.options.timeout);
    previous = configuration;
}
