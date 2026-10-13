import { PluginKey } from "@tiptap/pm/state";
import type { NeovimState } from "./types";

export const neovimKey = new PluginKey<NeovimState>("neovim");

export function initialState(enabled: boolean, cursor: number): NeovimState {
    return {
        enabled,
        mode: "normal",
        cursor,
        anchor: null,
        pending: [],
        goalColumn: null,
        register: null,
        lastChange: null,
        insertSession: null,
        search: "",
        searchDirection: 1,
        command: "",
        message: "",
    };
}
