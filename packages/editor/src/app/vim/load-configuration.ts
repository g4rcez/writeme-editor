import { FEATURES } from "@/lib/build-features";
import { defaultVimConfiguration, type VimConfiguration } from "./configuration";

let cachedSource: string | undefined;
let cachedResult: Promise<VimConfiguration> | undefined;

export function loadVimConfiguration(source: string): Promise<VimConfiguration> {
    if (!source.trim() || !FEATURES.vimScripts) return Promise.resolve(defaultVimConfiguration());
    if (cachedSource === source && cachedResult) return cachedResult;
    cachedSource = source;
    cachedResult = import("./scripts/compile").then(({ compileVimConfiguration }) => compileVimConfiguration(source));
    return cachedResult;
}
