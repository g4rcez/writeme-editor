import { Editor } from "@tiptap/core";
import { InlineMath } from "@tiptap/extension-mathematics";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Currency from "@/lib/currency";
import { Dates } from "@/lib/dates";
import { FrontmatterCommand, ReplacerCommands, UuidCommand } from "./commands";

describe("UuidCommand", () => {
    it("matches the UUID command instead of the date command", () => {
        expect(UuidCommand.find.test(">>uuid ")).toBe(true);
        expect(UuidCommand.find.test(">>date ")).toBe(false);
    });
});

describe("FrontmatterCommand", () => {
    it("matches the frontmatter text command", () => {
        expect(FrontmatterCommand.trigger).toBe(">>-- ");
        expect(FrontmatterCommand.find.test(">>-- ")).toBe(true);
        expect(FrontmatterCommand.find.test(">>— ")).toBe(true);
        expect(FrontmatterCommand.find.test(">>--")).toBe(true);
    });
});

describe("text commands in paragraphs", () => {
    const editors: Editor[] = [];

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-02T12:34:00Z"));
    });

    afterEach(() => {
        editors.splice(0).forEach((editor) => editor.destroy());
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const createEditor = (prefix: string): Editor => {
        const editor = new Editor({
            extensions: [StarterKit, InlineMath, ReplacerCommands],
            content: {
                type: "doc",
                content: [
                    {
                        type: "paragraph",
                        content: prefix ? [{ type: "text", text: prefix }] : [],
                    },
                ],
            },
        });
        editors.push(editor);
        editor.commands.setTextSelection(editor.state.doc.content.size - 1);
        return editor;
    };

    const typeCommand = (editor: Editor, command: string): void => {
        for (const text of command) {
            const { from, to } = editor.state.selection;
            const handled = editor.view.someProp("handleTextInput", (handler) =>
                handler(editor.view, from, to, text, () => editor.state.tr.insertText(text, from, to)),
            );
            if (!handled) editor.view.dispatch(editor.state.tr.insertText(text, from, to));
        }
    };

    for (const prefix of ["", "Before "]) {
        describe(prefix ? "after existing text" : "in an empty paragraph", () => {
            it.each([
                [">>math 1 + 1=", (): string => "1 + 1 = 2"],
                [">>eval 2 + 3;", (): string => "5"],
                [">>rule3(2, 4, x, 8)", (): string => "x = 4"],
                [">>time ", (): string => Dates.time(new Date())],
                [">>date ", (): string => Dates.isoDate(new Date())],
                [">>datetime ", (): string => `${Dates.isoDate(new Date())} ${Dates.time(new Date())}`],
            ] as const)("replaces %s", (command, expected) => {
                const editor = createEditor(prefix);
                typeCommand(editor, command);
                expect(editor.state.doc.textContent).toBe(prefix + expected());
                expect(editor.state.doc.firstChild?.type.name).toBe("paragraph");
            });

            it("inserts a UUID", () => {
                const editor = createEditor(prefix);
                typeCommand(editor, ">>uuid ");
                expect(editor.state.doc.textContent.slice(prefix.length)).toMatch(
                    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i,
                );
                expect(editor.state.doc.textContent.startsWith(prefix)).toBe(true);
            });

            it.each([10, 10.5])("replaces the whole currency command for %s USD", async (amount) => {
                const result: Currency.ConversionResult = {
                    from: "USD",
                    to: "EUR",
                    amount,
                    rate: 0.9,
                    result: amount * 0.9,
                    timestamp: Date.now(),
                    source: "cache",
                };
                const convert = vi.spyOn(Currency, "convertCurrency").mockResolvedValue(result);
                const editor = createEditor(prefix);
                typeCommand(editor, `>>money ${amount}USD to EUR=`);
                await Promise.resolve();
                expect(convert).toHaveBeenCalledWith(amount, "USD", "EUR");
                expect(editor.state.doc.textContent).toBe(prefix + Currency.formatConversionResult(result));
            });

            it("converts double-dollar text without retaining the delimiters", () => {
                const editor = createEditor(prefix);
                typeCommand(editor, "$$x^2$$ ");
                vi.advanceTimersByTime(100);
                const math = editor.state.doc.firstChild?.content.content.find(
                    (node) => node.type.name === "inlineMath",
                );
                expect(math?.attrs.latex).toBe("x^2");
                expect(editor.state.doc.textContent).toBe(prefix + " ");
            });

            it.each([
                [">>rule3(2/4, x/8)", "x = 4"],
                [">>rule3(2, 0, x, 8)", ">>rule3(2, 0, x, 8)"],
                [">>rule3(2, 4, x, y)", ">>rule3(2, 4, x, y)"],
                [">>rule3(2, 4, x)", ">>rule3(2, 4, x)"],
            ])("preserves validation and existing syntax for %s", (command, expected) => {
                const editor = createEditor(prefix);
                typeCommand(editor, command);
                expect(editor.state.doc.textContent).toBe(prefix + expected);
            });

            it("does not run text commands inside code blocks", () => {
                const editor = createEditor(prefix);
                editor.commands.setCodeBlock();
                typeCommand(editor, ">>time ");
                expect(editor.state.doc.firstChild?.type.name).toBe("codeBlock");
                expect(editor.state.doc.textContent).toBe(prefix + ">>time ");
            });
        });
    }
});
