type MathToken = {
    type: string;
    raw: string;
    latex: string;
};

type MarkdownExtension = {
    name: string;
    level: "block" | "inline";
    start(src: string): number;
    tokenizer(src: string): MathToken | undefined;
    renderer(token: MathToken): string;
};

export type MarkedLike = {
    use(extension: { extensions: MarkdownExtension[] }): void;
};

const escapeAttribute = (value: string): string =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const blockMathExtension = {
    name: "blockMath",
    level: "block" as const,
    start(src: string): number {
        return src.indexOf("$$");
    },
    tokenizer(src: string): MathToken | undefined {
        const match = src.match(/^\$\$(?:\r?\n([\s\S]*?)\r?\n\$\$|([^\r\n]+)\$\$)(?:\r?\n|$)/);
        if (!match) return undefined;

        const latex = (match[1] ?? match[2] ?? "").trim();
        if (!latex) return undefined;

        return {
            type: "blockMath",
            raw: match[0],
            latex,
        };
    },
    renderer(token: MathToken): string {
        return `<div data-type="block-math" data-latex="${escapeAttribute(token.latex)}"></div>\n`;
    },
};

const inlineMathExtension = {
    name: "inlineMath",
    level: "inline" as const,
    start(src: string): number {
        return src.indexOf("$");
    },
    tokenizer(src: string): MathToken | undefined {
        const match = src.match(/^\$(?!\$)(?!\d+\$)([^$\n]+?)\$(?!\d)/);
        if (!match) return undefined;

        return {
            type: "inlineMath",
            raw: match[0],
            latex: match[1]!.trim(),
        };
    },
    renderer(token: MathToken): string {
        return `<span data-type="inline-math" data-latex="${escapeAttribute(token.latex)}"></span>`;
    },
};

export function configureBlockMathMarkdown(marked: MarkedLike): void {
    marked.use({ extensions: [blockMathExtension] });
}

export function configureInlineMathMarkdown(marked: MarkedLike): void {
    marked.use({ extensions: [inlineMathExtension] });
}

export function configureMathMarkdown(marked: MarkedLike): void {
    configureBlockMathMarkdown(marked);
    configureInlineMathMarkdown(marked);
}
