import { transform } from "sucrase";
import { requireFeature } from "@/lib/build-features";
import {
    defaultVimConfiguration,
    MappingSchema,
    VimConfigurationSchema,
    type VimConfigApi,
    type VimConfiguration,
    type VimMapping,
} from "../configuration";
import { VimConfigurationError } from "../configuration-error";

export function evaluateVimConfiguration(source: string): VimConfiguration {
    requireFeature("vimScripts");
    if (source.length > 50_000) throw new VimConfigurationError("init.ts must be smaller than 50,000 characters.");
    const configuration = defaultVimConfiguration();
    let mappings: VimMapping[] = [];
    const api: VimConfigApi = {
        opt: configuration.options,
        keymap: {
            set: (modes, lhs, rhs, options = {}) => {
                for (const mode of typeof modes === "string" ? [modes] : modes) {
                    const mapping = MappingSchema.parse({ mode, lhs, rhs, options });
                    mappings = mappings.filter((current) => current.mode !== mode || current.lhs !== lhs);
                    mappings.push(mapping);
                    if (mappings.length > 500)
                        throw new VimConfigurationError("init.ts supports at most 500 mappings.");
                }
            },
            del: (modes, lhs) => {
                const selected = typeof modes === "string" ? [modes] : modes;
                mappings = mappings.filter((mapping) => !selected.includes(mapping.mode) || mapping.lhs !== lhs);
            },
        },
    };
    const compiled = transform(source, { transforms: ["typescript", "imports"], filePath: "init.ts" }).code;
    const exports: Record<string, unknown> = {};
    const execute = new Function("vim", "exports", "require", `"use strict";\n${compiled}`);
    execute(api, exports, () => {
        throw new VimConfigurationError("Runtime imports are not supported in init.ts. Type-only imports are allowed.");
    });
    if (exports.default !== undefined) {
        if (typeof exports.default !== "function")
            throw new VimConfigurationError("The default export must be a synchronous configuration function.");
        const result: unknown = exports.default(api);
        if (result instanceof Promise) throw new VimConfigurationError("init.ts configuration must be synchronous.");
    }
    return VimConfigurationSchema.parse({ options: configuration.options, mappings });
}
