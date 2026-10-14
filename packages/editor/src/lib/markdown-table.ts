import { Tokenizer, type Marked } from "marked";

function rowShape(row: string): { columns: number; closingPipe: boolean } {
    const text = row.trim();
    let columns = 1;
    let closingPipe = false;
    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === "\\") {
            index += 1;
        } else if (text[index] === "|") {
            closingPipe = index === text.length - 1;
            if (index !== 0 && !closingPipe) columns += 1;
        }
    }
    return { columns, closingPipe };
}

function padRow(row: string, columns: number, cell: string): string {
    const shape = rowShape(row);
    const missing = columns - shape.columns;
    if (missing === 0) return row;
    return `${row.trimEnd()}${shape.closingPipe ? "" : " |"}${` ${cell} |`.repeat(missing)}`;
}

export function configureTableMarkdown(markdown: Marked): void {
    markdown.use({
        tokenizer: {
            table(source) {
                const match = this.rules.block.table.exec(source);
                const header = match?.[1];
                const delimiter = match?.[2];
                if (!match || !header || !delimiter || !this.rules.other.tableDelimiter.test(delimiter)) return false;
                const headerColumns = rowShape(header).columns;
                const delimiterColumns = rowShape(delimiter).columns;
                const rows = match[3]?.trim() ? match[3].trimEnd().split("\n") : [];
                const columns = rows.reduce(
                    (width, row) => Math.max(width, rowShape(row).columns),
                    Math.max(headerColumns, delimiterColumns),
                );
                if (columns === headerColumns && columns === delimiterColumns) return false;

                const normalized =
                    `${padRow(header, columns, "")}\n${padRow(delimiter, columns, "---")}` +
                    match[0].slice(header.length + 1 + delimiter.length);
                const token = Tokenizer.prototype.table.call(this, normalized);
                if (!token) return false;
                // Advance the lexer over the original source, not the padded rows.
                token.raw = match[0].replace(/\n+$/, "");
                return token;
            },
        },
    });
}
