import { Marked } from "marked";
import { describe, expect, it } from "vitest";
import { configureTableMarkdown } from "./markdown-table";

function render(source: string): HTMLDivElement {
    const markdown = new Marked({ gfm: true });
    configureTableMarkdown(markdown);
    const element = document.createElement("div");
    element.innerHTML = markdown.parse(source, { async: false });
    return element;
}

function cells(element: HTMLElement): string[][] {
    return Array.from(element.querySelectorAll("tr"), (row) =>
        Array.from(row.querySelectorAll("th, td"), (cell) => cell.textContent ?? ""),
    );
}

describe("Markdown tables", () => {
    it.each([
        ["| --- | --- | --- | --- |", "| First | Second | Third | Fourth |"],
        ["| --- | --- |", "| First | Second | Third | Fourth |"],
        ["| --- | --- | --- |", "| First | Second | Third | Fourth |"],
    ])("preserves every cell when the separator is %s", (delimiter, body) => {
        const element = render(`Before\n\n| A | B | C |\n${delimiter}\n| Short | Row |\n${body}\n\n## After`);
        expect(cells(element)).toEqual([
            ["A", "B", "C", ""],
            ["Short", "Row", "", ""],
            ["First", "Second", "Third", "Fourth"],
        ]);
        expect(element.firstElementChild?.textContent).toBe("Before");
        expect(element.lastElementChild?.outerHTML).toBe("<h2>After</h2>");
    });

    it("preserves alignment and inline formatting while adding missing columns", () => {
        const element = render("A | B\n:--- | ---: | :---:\n**bold** | [link](https://example.com) | `code`");
        expect(cells(element)).toEqual([
            ["A", "B", ""],
            ["bold", "link", "code"],
        ]);
        expect(Array.from(element.querySelectorAll("th"), (cell) => cell.getAttribute("align"))).toEqual([
            "left",
            "right",
            "center",
        ]);
        expect(element.querySelector("td strong")?.textContent).toBe("bold");
        expect(element.querySelector("td a")?.getAttribute("href")).toBe("https://example.com");
        expect(element.querySelector("td code")?.textContent).toBe("code");
    });

    it("keeps escaped pipes inside cells rather than widening the table", () => {
        const element = render("| A \\| B | C |\n| --- | --- | --- |\n| `one\\|two` | three | four\\|five |");
        expect(cells(element)).toEqual([
            ["A | B", "C", ""],
            ["one|two", "three", "four|five"],
        ]);
    });

    it("recognizes unescaped pipes after an even number of backslashes", () => {
        const element = render("| A | B |\n| --- | --- |\n| slash\\\\| middle | last |");
        expect(cells(element)).toEqual([
            ["A", "B", ""],
            ["slash\\", "middle", "last"],
        ]);
    });

    it("handles a missing trailing pipe without losing the final cell", () => {
        const element = render("A | B\n--- | --- | ---\none | two | three\\|");
        expect(cells(element)).toEqual([
            ["A", "B", ""],
            ["one", "two", "three|"],
        ]);
    });

    it("also parses uneven tables nested in blockquotes", () => {
        const element = render("> | A | B |\n> | --- | --- | --- |\n> | one | two | three |\n\nOutside");
        expect(cells(element)).toEqual([
            ["A", "B", ""],
            ["one", "two", "three"],
        ]);
        expect(element.querySelector("blockquote table")).not.toBeNull();
        expect(element.lastElementChild?.textContent).toBe("Outside");
    });

    it.each(["```md\n", "~~~md\n", "    "])("keeps table syntax literal in code beginning with %j", (opening) => {
        const table = "| A | B |\n| --- | --- | --- |\n| one | two | three |";
        const source =
            opening === "    "
                ? table
                      .split("\n")
                      .map((line) => `${opening}${line}`)
                      .join("\n")
                : `${opening}${table}\n${opening.startsWith("```") ? "```" : "~~~"}`;
        const element = render(source);
        expect(element.querySelector("table")).toBeNull();
        expect(element.querySelector("pre code")?.textContent?.trimEnd()).toBe(table);
    });

    it("leaves valid tables, non-table prose, and HTML blocks unchanged", () => {
        for (const source of [
            "| A | B |\n| :--- | ---: |\n| one | two |\n| short |",
            "A | B\nnot | a delimiter\none | two | three",
            "<pre>\n| A | B |\n| --- | --- | --- |\n| one | two | three |\n</pre>",
        ]) {
            const expected = document.createElement("div");
            expected.innerHTML = new Marked({ gfm: true }).parse(source, { async: false });
            expect(render(source).innerHTML).toBe(expected.innerHTML);
        }
    });
});
