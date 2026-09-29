import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    editorActionsGlobalRef,
    editorGlobalRef,
    editorSearchGlobalRef,
    registerEditorActivation,
} from "./editor-global-ref";

describe("editor activation registry", () => {
    beforeEach(() => {
        editorGlobalRef.current = null;
        editorActionsGlobalRef.current = null;
        editorSearchGlobalRef.current = null;
    });

    it("activates the most recently mounted editor when the active editor closes", () => {
        const firstActivate = vi.fn();
        const secondActivate = vi.fn();
        const first = registerEditorActivation(firstActivate);
        const second = registerEditorActivation(secondActivate);

        first.activate();
        second.activate();
        second.unregister();

        expect(firstActivate).toHaveBeenCalledTimes(2);
        expect(secondActivate).toHaveBeenCalledOnce();

        first.unregister();
    });

    it("does not activate an editor after it unregisters", () => {
        const activate = vi.fn();
        const registered = registerEditorActivation(activate);

        registered.unregister();
        registered.activate();

        expect(activate).not.toHaveBeenCalled();
    });
});
