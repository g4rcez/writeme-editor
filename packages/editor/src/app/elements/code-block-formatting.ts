import { type Options } from "prettier";

export type SupportedLanguage =
    | "markdown"
    | "typescript"
    | "javascript"
    | "tsx"
    | "jsx"
    | "json"
    | "json5"
    | "jsonc"
    | "angular-ts"
    | "angular-html"
    | "vue"
    | "vue-html"
    | "css"
    | "yaml";


const PluginLoaders = {
    babel: () => import("prettier/plugins/babel"),
    estree: () => import("prettier/plugins/estree"),
    html: () => import("prettier/plugins/html"),
    markdown: () => import("prettier/plugins/markdown"),
    postcss: () => import("prettier/plugins/postcss"),
    typescript: () => import("prettier/plugins/typescript"),
    yaml: () => import("prettier/plugins/yaml"),
};

type PluginName = keyof typeof PluginLoaders;

const PrettierOptionsByLang: Record<SupportedLanguage, { parser: string; plugins: PluginName[] }> = {
    markdown: {
        parser: "markdown",
        plugins: ["markdown"],
    },
    typescript: {
        parser: "typescript",
        plugins: ["typescript", "estree"],
    },
    javascript: {
        parser: "babel",
        plugins: ["babel", "estree"],
    },
    tsx: {
        parser: "typescript",
        plugins: ["typescript", "estree"],
    },
    jsx: {
        parser: "babel",
        plugins: ["babel", "estree"],
    },
    json: {
        parser: "json",
        plugins: ["babel", "estree"],
    },
    json5: {
        parser: "json5",
        plugins: ["babel", "estree"],
    },
    jsonc: {
        parser: "json",
        plugins: ["babel", "estree"],
    },
    "angular-ts": {
        parser: "typescript",
        plugins: ["typescript", "estree"],
    },
    "angular-html": {
        parser: "angular",
        plugins: ["html", "estree"],
    },
    vue: {
        parser: "vue",
        plugins: [
            "html",
            "babel",
            "postcss",
            "estree",
            "typescript",
        ],
    },
    "vue-html": {
        parser: "vue",
        plugins: ["html", "babel", "postcss", "estree"],
    },
    css: {
        parser: "css",
        plugins: ["postcss"],
    },
    yaml: {
        parser: "yaml",
        plugins: ["yaml"],
    },
};

export const canFormat = (language: string): language is SupportedLanguage => language in PrettierOptionsByLang;

export async function formatCode(code: string, language: string): Promise<string> {
    if (!canFormat(language)) {
        return code;
    }

    const { parser, plugins: pluginNames } = PrettierOptionsByLang[language];

    try {
        const [{ format }, ...plugins] = await Promise.all([
            import("prettier/standalone"),
            ...pluginNames.map((name) => PluginLoaders[name]()),
        ]);
        return await format(code, {
            parser,
            plugins,
            semi: true,
            tabWidth: 2,
            printWidth: 80,
            useTabs: false,
            singleQuote: false,
            bracketSpacing: true,
            trailingComma: "all",
            arrowParens: "always",
            quoteProps: "as-needed",
            htmlWhitespaceSensitivity: "strict",
        } as Options);
    } catch (error) {
        console.warn("Failed to format code:", error);
        return code;
    }
}
