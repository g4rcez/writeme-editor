import { uuid } from "@g4rcez/components";
import { type Editor, Extension } from "@tiptap/core";
import { type ExtendedRegExpMatchArray } from "@tiptap/react";
import { evaluate } from "mathjs";
import { convertCurrency, formatConversionResult } from "../../lib/currency";
import {
  ClipboardCloseListenerCommand,
  ClipboardListenerCommand,
} from "./clipboard-listener.command";
import { replacerRules } from "./replace-rules";
import { ReplacerHandlerParams } from "./types";
import { Dates } from "@/lib/dates";
import { uiDispatch } from "@/store/ui.store";

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
  find: />>money (?<from>\d+(\.\d+)?[A-Z]{3})\s+(to|in)\s+(?<to>[A-Z]{3})\s*=$/i,
  replace: (capture, _, editor) => {
    let from = capture?.groups?.from?.trim().toUpperCase();
    let to = capture?.groups?.to?.trim().toUpperCase();
    if (!from || !to) {
      return "";
    }
    const amount = from.replace(/[A-Z]{3}$/g, "");
    from = from.match(/[A-Z]{3}$/g)?.[0];
    if (!from) return "";
    convertCurrency(Number(amount), from, to).then((result) => {
      editor
        .chain()
        .focus()
        .insertContent(formatConversionResult(result))
        .run();
    });
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

export const TimeCommand: ReplacerCommand = {
  find: />>time $/,
  replace: (capture) => {
    const expr = (capture[0].trim() || "").replace(/^>>time /, "").trim();
    if (expr === "") return "";
    return Dates.time(new Date());
  },
};

export const DateCommand: ReplacerCommand = {
  find: />>date $/,
  replace: (capture) => {
    const expr = (capture[0].trim() || "").replace(/^>>date /, "").trim();
    if (expr === "") return "";
    return Dates.isoDate(new Date());
  },
};

export const UuidCommand: ReplacerCommand = {
  find: />>date $/,
  replace: (capture) => {
    const expr = (capture[0].trim() || "").replace(/^>>uuid /, "").trim();
    if (expr === "") return "";
    return uuid();
  },
};

export const LatexInlineCommand: ReplacerCommand = {
  find: />>expr $/,
  replace: (_, __, editor) => {
    uiDispatch.setPrompt({
      open: true,
      title: "Inline math block:",
      onConfirm: (latex) => {
        if (latex) {
          setTimeout(() => {
            editor.chain().focus().insertInlineMath({ latex }).run();
          }, 100);
        }
      },
    });
    return "";
  },
};

const onlyNumbers = (x: string) => x.replace(/[^0-9]/g, "");

export const TableCommand: ReplacerCommand = {
  find: />>table ?\(\d+[x,]\d+\)$/,
  replace: (regex, _, editor) => {
    const coords = regex[0].match(/(\(\d+(x|,)\d+\))/)?.[0];
    const [cols, , rows] = coords
      ?.split(/(x|,)/)
      ?.map((x) => Number.parseInt(onlyNumbers(x))) || [3, 4];
    setTimeout(() => {
      editor
        .chain()
        .focus()
        .insertTable({ cols, rows, withHeaderRow: true })
        .run();
    }, 100);
    return "";
  },
};

export const LatexInlineTransformerCommand: ReplacerCommand = {
  find: /\$[^$]+\$ $/,
  replace: (regex, _, editor) => {
    const latex = regex[0];
    if (!latex) return "";
    setTimeout(() => {
      editor
        .chain()
        .focus()
        .insertInlineMath({
          latex: latex.trim().replace(/^\$/, "").replace(/\$$/, ""),
        })
        .run();
    }, 100);
    return "";
  },
};

export const ReplacerCommands = Extension.create({
  name: "commands-replacer",
  addInputRules() {
    return [
      replacerRules(this.editor, DateCommand),
      replacerRules(this.editor, TimeCommand),
      replacerRules(this.editor, UuidCommand),
      replacerRules(this.editor, EvalCommand),
      replacerRules(this.editor, CurrencyCommand),
      replacerRules(this.editor, MathCommand),
      replacerRules(this.editor, TableCommand),
      replacerRules(this.editor, LatexInlineCommand),
      replacerRules(this.editor, ClipboardListenerCommand),
      replacerRules(this.editor, LatexInlineTransformerCommand),
      replacerRules(this.editor, ClipboardCloseListenerCommand),
    ];
  },
});
