import type { Editor } from "@tiptap/core";
import { EditorView } from "@codemirror/view";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function useAgendaSource(noteId: string | null): void {
    const { search } = useLocation();
    useEffect(() => {
        const params = new URLSearchParams(search);
        const taskValue = params.get("task");
        const lineValue = params.get("line");
        if (!noteId || !taskValue || !/^\d+$/.test(taskValue)) return;
        const index = Number(taskValue);
        const main = document.getElementById("main-scroll-container");
        if (!main) return;
        let frame = 0;
        let initializingEditor: Editor | null = null;
        const navigate = (): boolean => {
            const root = document.getElementById(`editor-container-${noteId}`);
            const raw = root?.querySelector<HTMLElement>(".cm-editor");
            const view = raw ? EditorView.findFromDOM(raw) : null;
            if (root?.getAttribute("aria-busy") === "true") return false;
            if (view && lineValue && /^\d+$/.test(lineValue)) {
                const line = Number(lineValue);
                if (line < 1 || line > view.state.doc.lines || !view.dom.isConnected) return false;
                view.focus();
                view.dispatch({
                    selection: { anchor: view.state.doc.line(line).from },
                    effects: EditorView.scrollIntoView(view.state.doc.line(line).from, { y: "center" }),
                });
                return true;
            }
            const target = root?.querySelectorAll<HTMLElement>(".ProseMirror li[data-checked]")[index];
            if (!target || !target.isConnected) return false;
            const editorElement = root?.querySelector<HTMLElement>(".ProseMirror") as
                | (HTMLElement & { editor?: Editor })
                | null;
            const editor = editorElement?.editor;
            if (!editor || !editor.isInitialized || !editor.view.dom.isConnected || !editor.view.dom.contains(target)) {
                if (editor && !editor.isInitialized && initializingEditor !== editor) {
                    initializingEditor?.off("create", schedule);
                    initializingEditor = editor;
                    editor.on("create", schedule);
                }
                return false;
            }
            let current = 0;
            let position: number | null = null;
            editor.state.doc.descendants((node, pos) => {
                if (node.type.name === "taskItem" && current++ === index) position = pos + 2;
            });
            if (position === null) return false;
            editor.commands.focus(position, { scrollIntoView: true });
            target.scrollIntoView({ behavior: "instant", block: "center" });
            return true;
        };
        const schedule = (): void => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                if (navigate()) observer.disconnect();
            });
        };
        const observer = new MutationObserver(schedule);
        observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-busy"] });
        schedule();
        return () => {
            observer.disconnect();
            initializingEditor?.off("create", schedule);
            cancelAnimationFrame(frame);
        };
    }, [noteId, search]);
}
