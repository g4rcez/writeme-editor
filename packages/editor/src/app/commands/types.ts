import { EditorState } from "@tiptap/pm/state";
import type { CanCommands, ChainedCommands, ExtendedRegExpMatchArray, Range, SingleCommands } from "@tiptap/react";

export type ReplacerHandlerParams = {
    range: Range;
    state: EditorState;
    can: () => CanCommands;
    commands: SingleCommands;
    chain: () => ChainedCommands;
    match: ExtendedRegExpMatchArray;
};
