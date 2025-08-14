import { uuid } from "@g4rcez/components";
import { type Editor, Extension } from "@tiptap/core";
import { type ExtendedRegExpMatchArray } from "@tiptap/react";
import { evaluate } from "mathjs";
import { replacerRules } from "./replace-rules";
import { ReplacerHandlerParams } from "./types";
import {
  ClipboardCloseListenerCommand,
  ClipboardListenerCommand,
} from "./clipboard-listener.command";

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

export const ReplacerCommands = Extension.create({
  name: "commands-replacer",
  addInputRules() {
    console.log(this);
    return [
      replacerRules(this.editor, UuidCommand),
      replacerRules(this.editor, EvalCommand),
      replacerRules(this.editor, MathCommand),
      replacerRules(this.editor, ClipboardListenerCommand),
      replacerRules(this.editor, ClipboardCloseListenerCommand),
    ];
  },
});
