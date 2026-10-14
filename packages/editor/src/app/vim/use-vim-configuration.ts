import { useEffect, useState } from "react";
import { defaultVimConfiguration, type VimConfiguration } from "./configuration";
import { loadVimConfiguration } from "./load-configuration";
import { useVimSettings } from "./use-vim-settings";

export function useVimConfiguration(): {
    readonly configuration: VimConfiguration;
    readonly error: string;
    readonly loading: boolean;
} {
    const { source } = useVimSettings();
    const [result, setResult] = useState<{
        readonly source: string | null;
        readonly configuration: VimConfiguration;
        readonly error: string;
    }>(() => ({ source: null, configuration: defaultVimConfiguration(), error: "" }));
    useEffect(() => {
        let cancelled = false;
        void loadVimConfiguration(source)
            .then((next) => {
                if (cancelled) return;
                setResult({ source, configuration: next, error: "" });
            })
            .catch((reason: unknown) => {
                if (cancelled) return;
                setResult((current) => ({
                    source,
                    configuration: current.configuration,
                    error: reason instanceof Error ? reason.message : String(reason),
                }));
            });
        return () => {
            cancelled = true;
        };
    }, [source]);
    const loading = result.source !== source;
    return { configuration: result.configuration, error: loading ? "" : result.error, loading };
}
