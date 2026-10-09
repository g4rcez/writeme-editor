import { describe, expect, it } from "vitest";
import { Note } from "@/store/note";
import { extractNoteLinkReferences, findIncomingNoteLinks, resolveNoteLinks } from "./note-links";

const makeNote = (id: string, title: string, content = "", filePath?: string): Note =>
    Note.parse({ id, title, content, filePath });

describe("note link resolution", () => {
    it("extracts wiki, mention, and app links using normalized targets", () => {
        const references = extractNoteLinkReferences(
            '[[Project|Roadmap]] ![[Guide#Setup]] [mention](app "writeme-mention:note-1") app://note/note-2',
        );

        expect(references.map(({ kind, target }) => [kind, target])).toEqual([
            ["id", "note-1"],
            ["id", "note-2"],
            ["wiki", "Project"],
            ["wiki", "Guide"],
        ]);
    });

    it("resolves aliases, subpaths, and workspace-relative paths without guessing duplicate titles", () => {
        const current = makeNote(
            "current",
            "Current",
            "[[Project|Roadmap]] [[Project#Next steps]] [[folder/Guide.md]] [[Ambiguous]]",
        );
        const project = makeNote("project", "Project");
        const guide = makeNote("guide", "Guide", "", "/workspace/folder/Guide.md");
        const ambiguousA = makeNote("ambiguous-a", "Ambiguous");
        const ambiguousB = makeNote("ambiguous-b", "Ambiguous");

        expect(
            resolveNoteLinks(current, [current, project, guide, ambiguousA, ambiguousB]).map(({ note }) => note.id),
        ).toEqual(["project", "guide"]);
    });

    it("deduplicates targets, ignores attachments, and excludes self-links", () => {
        const current = makeNote(
            "current",
            "Current",
            "[[Current]] [[Project]] [[Project|Plan]] ![[assets/photo.png]] [[sound.mp3]]",
        );
        const project = makeNote("project", "Project");

        const links = resolveNoteLinks(current, [current, project]);

        expect(links).toHaveLength(1);
        expect(links[0]?.note.id).toBe("project");
        expect(links[0]?.references).toHaveLength(2);
    });

    it("returns one incoming result per source note with a plain-text excerpt", () => {
        const target = makeNote("target", "Project");
        const source = makeNote(
            "source",
            "Planning",
            "## Next\nWe should review [[Project|the roadmap]] and [[Project#Milestones]].\n",
        );
        const self = makeNote("self", "Self", "[[Self]]");

        expect(findIncomingNoteLinks(target, [target, source, self])).toEqual([
            {
                note: source,
                excerpt: "We should review the roadmap and Project#Milestones.",
            },
        ]);
    });
});
