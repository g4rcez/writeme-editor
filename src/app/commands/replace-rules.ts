import {
  type Editor,
  InputRule,
  type ExtendedRegExpMatchArray,
  type InputRuleFinder,
} from "@tiptap/react";
import { ReplacerHandlerParams } from "./types";

export function replacerRules(
  editor: Editor,
  config: {
    find: InputRuleFinder;
    replace: (
      match: ExtendedRegExpMatchArray,
      props: ReplacerHandlerParams,
      editor: Editor,
    ) => string;
  },
) {
  return new InputRule({
    find: config.find,
    handler: (props) => {
      const range = props.range;
      const match = props.match;
      const state = props.state;
      let insert = config.replace(match, props, editor);
      let start = range.from;
      const end = range.to;
      if (match[1]) {
        const offset = match[0].lastIndexOf(match[1]);
        insert += match[0].slice(offset + match[1].length);
        start += offset;
        const cutOff = start - end;
        if (cutOff > 0) {
          insert = match[0].slice(offset - cutOff, offset) + insert;
          start = end;
        }
      }
      state.tr.insertText(insert, start, end);
    },
  });
}
