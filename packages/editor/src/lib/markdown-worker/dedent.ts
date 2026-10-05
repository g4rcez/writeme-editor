export function dedent(text: string): string {
    const lines = text.split("\n");
    let minIndent = Infinity;
    for (const line of lines) {
        if (line.trim().length === 0) continue;
        const indent = line.match(/^\s*/)?.[0].length ?? 0;
        if (indent < minIndent) minIndent = indent;
    }
    if (minIndent === Infinity) return text;
    return lines.map((line) => (line.length >= minIndent ? line.slice(minIndent) : line)).join("\n");
}
