import { describe, expect, it } from "vitest";
import { canFormat, formatCode } from "./code-block-formatting";

describe("formatCode with lazily loaded prettier plugins", () => {
    it.each([
        ["typescript", "const a={b:1}", "const a = { b: 1 };\n"],
        ["javascript", "let x=1", "let x = 1;\n"],
        ["json", '{"a":1,"b":[1,2]}', '{ "a": 1, "b": [1, 2] }\n'],
        ["css", "a{color:red}", "a {\n  color: red;\n}\n"],
        ["yaml", "a:   1", "a: 1\n"],
        ["markdown", "#   Title", "# Title\n"],
    ])("formats %s", async (language, input, expected) => {
        expect(await formatCode(input, language)).toBe(expected);
    });

    it("returns unsupported languages untouched", async () => {
        expect(canFormat("brainfuck")).toBe(false);
        expect(await formatCode("++[>+<-]", "brainfuck")).toBe("++[>+<-]");
    });

    it("returns the original code when it does not parse", async () => {
        expect(await formatCode("const = ;", "typescript")).toBe("const = ;");
    });
});
