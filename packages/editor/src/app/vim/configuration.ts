import { z } from "zod";

const ModeSchema = z.enum(["normal", "insert", "visual"]);
const OptionsSchema = z.object({
    leader: z.string().min(1).max(8).default(" "),
    timeout: z.number().int().min(100).max(5000).default(600),
    initialMode: z.enum(["normal", "insert"]).default("normal"),
});
export const MappingSchema = z.object({
    mode: ModeSchema,
    lhs: z.string().min(1).max(100),
    rhs: z.string().min(1).max(500),
    options: z
        .object({
            description: z.string().max(200).optional(),
            remap: z.boolean().optional(),
        })
        .strict()
        .default({}),
});
export const VimConfigurationSchema = z.object({ options: OptionsSchema, mappings: z.array(MappingSchema).max(500) });
export type VimConfiguration = z.infer<typeof VimConfigurationSchema>;
export type VimMapping = z.infer<typeof MappingSchema>;
export type VimConfigApi = {
    readonly opt: VimConfiguration["options"];
    readonly keymap: {
        readonly set: (
            modes: VimMapping["mode"] | readonly VimMapping["mode"][],
            lhs: string,
            rhs: string,
            options?: VimMapping["options"],
        ) => void;
        readonly del: (modes: VimMapping["mode"] | readonly VimMapping["mode"][], lhs: string) => void;
    };
};

export function defaultVimConfiguration(): VimConfiguration {
    return VimConfigurationSchema.parse({ options: {}, mappings: [] });
}

export const EXAMPLE_VIM_INIT = `import type { VimConfigApi } from "@writeme/vim";

export default function configure(vim: VimConfigApi): void {
    vim.opt.leader = " ";
    vim.opt.timeout = 600;
    vim.opt.initialMode = "normal";

    vim.keymap.set("normal", "H", "0");
    vim.keymap.set("normal", "L", "$", { description: "End of line" });
    vim.keymap.set("insert", "jk", "<Esc>");
}
`;
