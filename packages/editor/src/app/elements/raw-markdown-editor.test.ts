import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import { createMarkdownSearchController } from "./raw-markdown-editor";

const views: EditorView[] = [];

afterEach(() => {
    views.splice(0).forEach((view) => view.destroy());
    document.body.replaceChildren();
});

describe("Markdown search controller", () => {
    it("searches, navigates, and replaces Markdown text", () => {
        const view = new EditorView({
            parent: document.body,
            state: EditorState.create({ doc: "Alpha alpha beta" }),
        });
        views.push(view);
        const search = createMarkdownSearchController(view);

        search.setSearchTerm("alpha");
        expect(search.getState()).toMatchObject({ resultsCount: 2, resultIndex: 0 });
        expect(view.state.selection.main.from).toBe(0);

        search.nextSearchResult();
        expect(view.state.selection.main.from).toBe(6);
        search.replace("gamma");
        expect(view.state.doc.toString()).toBe("Alpha gamma beta");

        search.setCaseSensitive(true);
        expect(search.getState().resultsCount).toBe(0);
        search.setSearchTerm("Alpha");
        search.replaceAll("Delta");
        expect(view.state.doc.toString()).toBe("Delta gamma beta");
    });
});
