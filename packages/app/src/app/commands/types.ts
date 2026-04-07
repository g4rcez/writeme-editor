import { EditorState } from "@tiptap/pm/state";
import {
  InputRule,
  type CanCommands,
  type ChainedCommands,
  type ExtendedRegExpMatchArray,
  type InputRuleFinder,
  type Range,
  type SingleCommands,
} from "@tiptap/react";

export type ReplacerHandlerParams = {
  range: Range;
  state: EditorState;
  can: () => CanCommands;
  commands: SingleCommands;
  chain: () => ChainedCommands;
  match: ExtendedRegExpMatchArray;
};

