import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { NeovimState } from "./types";
import { NeovimController } from "./controller";
import { nextCharacter, normalPosition } from "./document";
import { eventKey } from "./keymap";
import { initialState, neovimKey } from "./state";

export { neovimKey } from "./state";
export type {
    MappingContext,
    Motion,
    MotionContext,
    MotionResult,
    NeovimMode,
    NeovimState,
    Operator,
    TextObject,
    VimRange,
} from "./types";

type NeovimOptions = {
    readonly enabled: boolean;
    readonly initialMode: "normal" | "insert";
    readonly leader: string;
    readonly timeout: number;
};
export type NeovimApi = Pick<
    NeovimController,
    | "keymap"
    | "motions"
    | "textObjects"
    | "operators"
    | "getState"
    | "setEnabled"
    | "setMode"
    | "feedKeys"
    | "feed"
    | "update"
    | "attach"
    | "destroy"
    | "flushPending"
>;

declare module "@tiptap/core" {
    interface Storage {
        neovim: NeovimApi;
    }
    interface Commands<ReturnType> {
        neovim: { setNeovimEnabled: (enabled: boolean) => ReturnType };
    }
}

export const Neovim = Extension.create<NeovimOptions, NeovimApi>({
    name: "neovim",
    priority: 1200,
    addOptions() {
        return { enabled: false, initialMode: "normal", leader: " ", timeout: 600 };
    },
    addStorage() {
        const controller = new NeovimController(this.options.leader, this.options.timeout);
        return {
            keymap: controller.keymap,
            motions: controller.motions,
            operators: controller.operators,
            textObjects: controller.textObjects,
            getState: controller.getState.bind(controller),
            setEnabled: controller.setEnabled.bind(controller),
            setMode: controller.setMode.bind(controller),
            feedKeys: controller.feedKeys.bind(controller),
            feed: controller.feed.bind(controller),
            update: controller.update.bind(controller),
            attach: controller.attach.bind(controller),
            destroy: controller.destroy.bind(controller),
            flushPending: controller.flushPending.bind(controller),
        };
    },
    onBeforeCreate() {
        this.storage.attach(this.editor);
    },
    onDestroy() {
        this.storage.destroy();
    },
    addCommands() {
        return {
            setNeovimEnabled:
                (enabled) =>
                ({ tr, dispatch }) => {
                    if (dispatch) {
                        this.storage.destroy();
                        const vim = this.storage.getState();
                        if (vim?.mode === "insert" && vim.pending.length) tr.insertText(vim.pending.join(""));
                        tr.setMeta(neovimKey, {
                            enabled,
                            mode: "normal",
                            pending: [],
                            anchor: null,
                            insertSession: null,
                            command: "",
                        } satisfies Partial<NeovimState>);
                    }
                    return true;
                },
        };
    },
    addProseMirrorPlugins() {
        const controller = this.storage;
        const options = this.options;
        return [
            new Plugin<NeovimState>({
                key: neovimKey,
                state: {
                    init: (_, state) => ({
                        ...initialState(options.enabled, state.selection.head),
                        mode: options.initialMode,
                    }),
                    apply: (tr, value) => {
                        const patch: Partial<NeovimState> | undefined = tr.getMeta(neovimKey);
                        if (!value.enabled && !patch?.enabled) return { ...value, ...patch, cursor: tr.selection.head };
                        const visual = value.mode === "visual" || value.mode === "visual-line";
                        const cursor =
                            tr.selectionSet && !visual
                                ? tr.selection.head
                                : tr.docChanged
                                  ? tr.mapping.map(value.cursor)
                                  : value.cursor;
                        const next = {
                            ...value,
                            cursor,
                            anchor: value.anchor === null ? null : tr.mapping.map(value.anchor),
                            ...patch,
                        };
                        return {
                            ...next,
                            cursor:
                                next.mode === "insert" || next.mode === "replace"
                                    ? tr.selection.head
                                    : normalPosition(tr.doc, next.cursor),
                        };
                    },
                },
                props: {
                    attributes: (state) => {
                        const vim = neovimKey.getState(state);
                        return {
                            "data-neovim-mode": vim?.enabled ? vim.mode : "disabled",
                            "aria-keyshortcuts": vim?.enabled ? "Escape" : "",
                        };
                    },
                    handleKeyDown: (view, event) => {
                        if (event.isComposing || view.composing) return false;
                        const vim = neovimKey.getState(view.state);
                        if (!vim?.enabled) return false;
                        const key = eventKey(event);
                        if (!key) return false;
                        if ((vim.mode === "insert" || vim.mode === "replace") && event.key.startsWith("Arrow"))
                            return false;
                        return controller.feed(key);
                    },
                    handleTextInput: (view) => {
                        const vim = neovimKey.getState(view.state);
                        return Boolean(vim?.enabled && vim.mode !== "insert" && vim.mode !== "replace");
                    },
                    handlePaste: (view) => {
                        const vim = neovimKey.getState(view.state);
                        return Boolean(vim?.enabled && vim.mode !== "insert" && vim.mode !== "replace");
                    },
                    handleDOMEvents: {
                        beforeinput: (view, event) => {
                            const vim = neovimKey.getState(view.state);
                            if (!vim?.enabled || vim.mode === "insert" || vim.mode === "replace" || !event.cancelable)
                                return false;
                            event.preventDefault();
                            return true;
                        },
                        blur: () => {
                            controller.flushPending();
                            return false;
                        },
                    },
                    decorations: (state) => {
                        const vim = neovimKey.getState(state);
                        if (!vim?.enabled || ["insert", "replace"].includes(vim.mode)) return null;
                        const from = vim.cursor;
                        const to = nextCharacter(state.doc, from);
                        return DecorationSet.create(
                            state.doc,
                            from === to
                                ? [
                                      Decoration.widget(from, () => {
                                          const cursor = document.createElement("span");
                                          cursor.className = "neovim-empty-cursor";
                                          cursor.setAttribute("aria-hidden", "true");
                                          return cursor;
                                      }),
                                  ]
                                : [Decoration.inline(from, to, { class: "neovim-cursor" })],
                        );
                    },
                },
            }),
        ];
    },
});
