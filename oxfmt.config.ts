import { defineConfig } from "oxfmt";

export default defineConfig({
    printWidth: 120,
    semi: true,
    singleQuote: false,
    trailingComma: "all",
    tabWidth: 4,
    arrowParens: "always",
    endOfLine: "lf",
    embeddedLanguageFormatting: "auto",
    sortTailwindcss: {
        stylesheet: "./src/index.css",
        functions: ["clsx", "cn", "css"],
        preserveWhitespace: true,
        attributes: ["class", "className", "container", "containerClassName"],
    },
    sortImports: {
        newlinesBetween: false,
        groups: [
            "type-import",
            ["value-builtin", "value-external"],
            "type-internal",
            "value-internal",
            ["type-parent", "type-sibling", "type-index"],
            ["value-parent", "value-sibling", "value-index"],
            "unknown",
        ],
    },
});
