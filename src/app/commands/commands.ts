import { uuid } from "@g4rcez/components";
import { type Editor, Extension } from "@tiptap/core";
import { type ExtendedRegExpMatchArray } from "@tiptap/react";
import { evaluate } from "mathjs";
import {
  convertCurrency,
  formatConversionResult,
  formatErrorMessage,
} from "../../lib/currency";
import {
  ClipboardCloseListenerCommand,
  ClipboardListenerCommand,
} from "./clipboard-listener.command";
import { replacerRules } from "./replace-rules";
import { ReplacerHandlerParams } from "./types";

export type ReplacerCommand = {
  find: RegExp;
  replace: (
    thing: ExtendedRegExpMatchArray,
    props: ReplacerHandlerParams,
    editor: Editor,
  ) => string;
};

const sanitizeExpr = (expr = "") =>
  expr
    .replace(/>>math/, "")
    .trim()
    .replace(/\*\*/g, "^")
    .replace(/=$/g, "");

export const CurrencyCommand: ReplacerCommand = {
  find: />>money (?<from>\d+(\.\d+)?[A-Z]{3})\s+(to|in)\s+(?<to>[A-Z]{3})\s*=$/,
  replace: (capture, _, editor) => {
    let from = capture?.groups.from?.trim();
    let to = capture?.groups.to?.trim();
    if (!from || !to) {
      return "";
    }
    const amount = from.replace(/[A-Z]{3}$/g, "");
    from = from.match(/[A-Z]{3}$/g)[0];
    setTimeout(() => {
      convertCurrency(Number(amount), from, to)
        .then((result) => {
          editor
            .chain()
            .focus()
            .selectTextblockEnd()
            .insertContent(formatConversionResult(result))
            .run();
        })
        .catch((error) => {
          const errorMsg = formatErrorMessage(error, from, to);
          editor.chain().focus().insertContent("").run();
        });
    }, 50);
    return "";
  },
};

const MathCommand: ReplacerCommand = {
  find: />>math [^=]+ ?=$/,
  replace: (capture) => {
    const expr = capture[0].trim() || "";
    if (expr === "") return "";
    const clean = sanitizeExpr(expr);
    const result = `${evaluate(clean)}`;
    return `${clean} = ${result}`;
  },
};

const EvalCommand: ReplacerCommand = {
  find: />>eval [^;]+ ?;$/,
  replace: (capture) => {
    const expr = (capture[0].trim() || "").replace(/^>>eval /, "").trim();
    if (expr === "") return "";
    const x = eval(expr);
    return `${x}`;
  },
};

export const UuidCommand: ReplacerCommand = {
  find: />>uuid $/,
  replace: (capture) => {
    const expr = (capture[0].trim() || "").replace(/^>>uuid /, "").trim();
    if (expr === "") return "";
    return uuid();
  },
};

export const ExcalidrawCommand: ReplacerCommand = {
  find: />>draw $/,
  replace: (_, __, editor) => {
    setTimeout(() => {
      editor
        .chain()
        .joinDown()
        .insertContent("```excalidraw")
        .insertContent("\n")
        .insertContent("```")
        .run();
    }, 100);
    return "";
  },
};

export const LatexInlineCommand: ReplacerCommand = {
  find: />>expr $/,
  replace: (_, __, editor) => {
    const latex = prompt("Inline math block:");
    setTimeout(() => {
      if (latex) {
        editor.chain().joinDown().insertInlineMath({ latex }).focus().run();
      }
    }, 100);
    return "";
  },
};

const onlyNumbers = (x: string) => x.replace(/[^0-9]/g, "");

export const TableCommand: ReplacerCommand = {
  find: />>table ?\(\d+[x,]\d+\)$/,
  replace: (regex, __, editor) => {
    setTimeout(() => {
      const coords = regex[0].match(/(\(\d+(x|,)\d+\))/)?.[0];
      const [cols, , rows] = coords
        .split(/(x|,)/)
        ?.map((x) => Number.parseInt(onlyNumbers(x))) || [3, 4];
      editor
        .chain()
        .focus()
        .insertTable({ cols, rows, withHeaderRow: true })
        .run();
    }, 100);
    return "";
  },
};

export const LatexCommand: ReplacerCommand = {
  find: />>latex $/,
  replace: (_, __, editor) => {
    const latex = prompt("Block math:");
    setTimeout(() => {
      if (latex) {
        editor.chain().joinDown().insertBlockMath({ latex }).focus().run();
      }
    }, 100);
    return "";
  },
};

export const LatexInlineTransformerCommand: ReplacerCommand = {
  find: /\$[^$]+\$ $/,
  replace: (regex, _, editor) => {
    const latex = regex[0];
    if (!latex) return;
    setTimeout(() => {
      editor
        .chain()
        .insertInlineMath({
          latex: latex.trim().replace(/^\$/, "").replace(/\$$/, ""),
        })
        .focus()
        .run();
    }, 400);
    return "";
  },
};

export const ReplacerCommands = Extension.create({
  name: "commands-replacer",
  addInputRules() {
    return [
      replacerRules(this.editor, UuidCommand),
      replacerRules(this.editor, EvalCommand),
      replacerRules(this.editor, CurrencyCommand), // MUST come before MathCommand!
      replacerRules(this.editor, MathCommand),
      replacerRules(this.editor, LatexCommand),
      replacerRules(this.editor, TableCommand),
      replacerRules(this.editor, LatexInlineCommand),
      replacerRules(this.editor, ClipboardListenerCommand),
      replacerRules(this.editor, LatexInlineTransformerCommand),
      replacerRules(this.editor, ClipboardCloseListenerCommand),
      replacerRules(this.editor, ExcalidrawCommand),
    ];
  },
});
