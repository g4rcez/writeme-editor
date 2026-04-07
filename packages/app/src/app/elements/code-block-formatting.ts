import { type Options } from "prettier";
import * as prettierPluginBabel from "prettier/plugins/babel";
import * as prettierPluginEstree from "prettier/plugins/estree";
import * as prettierPluginHtml from "prettier/plugins/html";
import * as prettierPluginMarkdown from "prettier/plugins/markdown";
import * as prettierPluginPostcss from "prettier/plugins/postcss";
import * as prettierPluginTypescript from "prettier/plugins/typescript";
import * as prettierPluginYaml from "prettier/plugins/yaml";
import { format } from "prettier/standalone";

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

const PrettierOptionsByLang: Record<
  SupportedLanguage,
  { parser: string; plugins: any[] }
> = {
  markdown: {
    parser: "markdown",
    plugins: [prettierPluginMarkdown],
  },
  typescript: {
    parser: "typescript",
    plugins: [prettierPluginTypescript, prettierPluginEstree],
  },
  javascript: {
    parser: "babel",
    plugins: [prettierPluginBabel, prettierPluginEstree],
  },
  tsx: {
    parser: "typescript",
    plugins: [prettierPluginTypescript, prettierPluginEstree],
  },
  jsx: {
    parser: "babel",
    plugins: [prettierPluginBabel, prettierPluginEstree],
  },
  json: {
    parser: "json",
    plugins: [prettierPluginBabel, prettierPluginEstree],
  },
  json5: {
    parser: "json5",
    plugins: [prettierPluginBabel, prettierPluginEstree],
  },
  jsonc: {
    parser: "json",
    plugins: [prettierPluginBabel, prettierPluginEstree],
  },
  "angular-ts": {
    parser: "typescript",
    plugins: [prettierPluginTypescript, prettierPluginEstree],
  },
  "angular-html": {
    parser: "angular",
    plugins: [prettierPluginHtml, prettierPluginEstree],
  },
  vue: {
    parser: "vue",
    plugins: [
      prettierPluginHtml,
      prettierPluginBabel,
      prettierPluginPostcss,
      prettierPluginEstree,
      prettierPluginTypescript,
    ],
  },
  "vue-html": {
    parser: "vue",
    plugins: [
      prettierPluginHtml,
      prettierPluginBabel,
      prettierPluginPostcss,
      prettierPluginEstree,
    ],
  },
  css: {
    parser: "css",
    plugins: [prettierPluginPostcss],
  },
  yaml: {
    parser: "yaml",
    plugins: [prettierPluginYaml],
  },
};

export const canFormat = (language: string): language is SupportedLanguage =>
  language in PrettierOptionsByLang;

export async function formatCode(
  code: string,
  language: string,
): Promise<string> {
  if (!canFormat(language)) {
    return code;
  }

  const { parser, plugins } = PrettierOptionsByLang[language];

  try {
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
