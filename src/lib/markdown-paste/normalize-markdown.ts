const ESCAPABLE_MARKDOWN_CHARACTERS = new Set([
    "\\",
    "`",
    "*",
    "_",
    "{",
    "}",
    "[",
    "]",
    "(",
    ")",
    "#",
    "+",
    "-",
    ".",
    "!",
    ">",
    "|",
    "~",
]);

const FENCE_TOKEN_PREFIX = "\uE000writeme-fence-";
const FENCE_TOKEN_SUFFIX = "\uE001";
const MATH_TOKEN_PREFIX = "\uE000writeme-math-";
const MATH_TOKEN_SUFFIX = "\uE002";

const ESCAPED_MARKDOWN_PATTERNS = [
    /(?:^|\n)[ \t]*\\#{1,6}(?=\s)/,
    /(?:^|\n)[ \t]*\\[-+*](?=\s)/,
    /(?:^|\n)[ \t]*\d+\\\.(?=\s)/,
    /(?:^|\n)[ \t]*\\(?:`{3,}|~{3,})/,
    /\\(?:\*{2}|_{2}|~{2})/,
    /\\>/,
    /(?:^|\n)[ \t]*\\(?:-{3,}|\*{3,}|_{3,})[ \t]*$/m,
];

const HTML_ENTITY_PATTERN = /(?:^|\n)&(?:amp|apos|gt|lt|nbsp|quot|#\d+|#x[\da-f]+);/i;

type FenceLine = {
    indent: string;
    marker: string;
    rest: string;
};

function hasEscapedMarkdownSyntax(text: string): boolean {
    return ESCAPED_MARKDOWN_PATTERNS.some((pattern) => pattern.test(text)) || HTML_ENTITY_PATTERN.test(text);
}

function parseFenceLine(line: string): FenceLine | null {
    const match = line.match(/^([ \t]*)(\\*)(`{3,}|~{3,})(.*)$/);
    if (!match) {
        return null;
    }

    return {
        indent: match[1] ?? "",
        marker: match[3] ?? "",
        rest: match[4] ?? "",
    };
}

function normalizeFenceLine(parsed: FenceLine): string {
    return `${parsed.indent}${parsed.marker}${parsed.rest}`;
}

function protectFencedCode(text: string): { text: string; fences: string[] } {
    const lines = text.split("\n");
    const output: string[] = [];
    const fences: string[] = [];

    for (let index = 0; index < lines.length;) {
        const opening = parseFenceLine(lines[index] ?? "");
        if (!opening) {
            output.push(lines[index] ?? "");
            index += 1;
            continue;
        }

        const block = [normalizeFenceLine(opening)];
        const openingCharacter = opening.marker[0];
        let nextIndex = index + 1;

        for (; nextIndex < lines.length; nextIndex += 1) {
            const line = lines[nextIndex] ?? "";
            const closing = parseFenceLine(line);
            if (closing && closing.marker[0] === openingCharacter && closing.marker.length >= opening.marker.length) {
                block.push(normalizeFenceLine(closing));
                nextIndex += 1;
                break;
            }
            block.push(line);
        }

        const fenceIndex = fences.push(block.join("\n")) - 1;
        output.push(`${FENCE_TOKEN_PREFIX}${fenceIndex}${FENCE_TOKEN_SUFFIX}`);
        index = nextIndex;
    }

    return { text: output.join("\n"), fences };
}

function normalizeMathSegment(segment: string): string {
    let normalized = "";

    for (let index = 0; index < segment.length; index += 1) {
        const character = segment[index];
        const nextCharacter = segment[index + 1];
        const characterAfterNext = segment[index + 2];

        if (
            character === "\\" &&
            nextCharacter === "\\" &&
            characterAfterNext &&
            /[A-Za-z{}[\](),.;:+\-*=]/.test(characterAfterNext)
        ) {
            normalized += "\\";
            index += 1;
            continue;
        }

        normalized += character;
    }

    return normalized;
}

function protectMath(text: string): { text: string; math: string[] } {
    const math: string[] = [];
    const protectedText = text.replace(/\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\\\n])*\$/g, (segment) => {
        const mathIndex = math.push(normalizeMathSegment(segment)) - 1;
        return `${MATH_TOKEN_PREFIX}${mathIndex}${MATH_TOKEN_SUFFIX}`;
    });

    return { text: protectedText, math };
}

function decodeHtmlEntities(text: string): string {
    return text.replace(/&(#(?:x[\da-f]+|\d+)|[a-z][a-z\d]+);/gi, (entity, value: string) => {
        if (value === "amp") return "&";
        if (value === "apos") return "'";
        if (value === "gt") return ">";
        if (value === "lt") return "<";
        if (value === "nbsp") return " ";
        if (value === "quot") return '"';

        const codePoint = value.startsWith("#x")
            ? Number.parseInt(value.slice(2), 16)
            : Number.parseInt(value.slice(1), 10);
        if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
            return entity;
        }
        return String.fromCodePoint(codePoint);
    });
}

function unescapeMarkdown(text: string): string {
    let normalized = "";

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        const nextCharacter = text[index + 1];
        if (character === "\\" && nextCharacter && ESCAPABLE_MARKDOWN_CHARACTERS.has(nextCharacter)) {
            normalized += nextCharacter;
            index += 1;
            continue;
        }
        normalized += character;
    }

    return normalized;
}

function addMissingMarkdownBoundaries(text: string): string {
    const withBlockquoteBoundaries = text.replace(/([^\s])(?=(?:&gt;|\\>)\s|(?:&gt;|\\>){2})/g, "$1\n");

    return withBlockquoteBoundaries.replace(/([.!?])(?=(?:\\#{1,6}\s|\\?[-+*]\s|\d+\\?\.\s))/g, "$1\n");
}

function removeEscapedSeparatorLines(text: string): string {
    return text
        .split("\n")
        .map((line) => (/^[ \t]*\\{1,2}[ \t]*$/.test(line) ? "" : line))
        .join("\n");
}

function restoreTokens(text: string, tokens: string[], prefix: string, suffix: string): string {
    return tokens.reduce((current, token, index) => current.split(`${prefix}${index}${suffix}`).join(token), text);
}

/**
 * Normalizes Markdown copied from sources that escaped Markdown syntax for display.
 *
 * Normal Markdown escapes are kept unchanged. Once the input clearly contains an
 * escaped Markdown document, escaped syntax is restored outside math and fenced
 * code, while fenced code remains literal.
 */
export function normalizeMarkdownPaste(text: string): string {
    const normalizedLineEndings = text.replace(/\r\n?/g, "\n");
    if (!hasEscapedMarkdownSyntax(normalizedLineEndings)) {
        return normalizedLineEndings;
    }

    const fenced = protectFencedCode(normalizedLineEndings);
    const withBoundaries = addMissingMarkdownBoundaries(fenced.text);
    const math = protectMath(withBoundaries);
    const decoded = decodeHtmlEntities(unescapeMarkdown(math.text));
    const cleaned = removeEscapedSeparatorLines(decoded);
    const withMath = restoreTokens(cleaned, math.math, MATH_TOKEN_PREFIX, MATH_TOKEN_SUFFIX);

    return restoreTokens(withMath, fenced.fences, FENCE_TOKEN_PREFIX, FENCE_TOKEN_SUFFIX);
}
