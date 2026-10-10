import { InputRule, type Editor, type ExtendedRegExpMatchArray, type InputRuleFinder } from "@tiptap/react";
import { type ReplacerHandlerParams } from "./types";

export function replacerRules(
    editor: Editor,
    config: {
        find: InputRuleFinder;
        replace: (match: ExtendedRegExpMatchArray, props: ReplacerHandlerParams, editor: Editor) => string;
    },
) {
    return new InputRule({
        find: config.find,
        handler: (props) => {
            const insert = config.replace(props.match, props, editor);
            // Capture groups are command arguments, not replacement boundaries.
            props.state.tr.insertText(insert, props.range.from, props.range.to);
        },
    });
}
