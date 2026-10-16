import { describe, expect, it } from "vitest";
import { Note, NoteType } from "@/store/note";
import { formatNoteMention } from "./markdown-links";
import { repairedMarkdown } from "./note-link-repair";
import {
    extractNoteLinkReferences,
    extractWorkspaceFileReferences,
    findIncomingNoteLinks,
    findUnlinkedNoteMentions,
    findUnresolvedNoteLinks,
    resolveNoteLinks,
} from "./note-links";

const makeNote = (id: string, title: string, content = "", filePath?: string): Note =>
    Note.parse({ id, title, content, filePath });

describe("note link resolution", () => {
    it("gives complete marked app links precedence without hiding separate bare URLs", () => {
        const wrapped = '[Old name](app://note/deleted "writeme-mention:deleted")';
        const content = `${wrapped} and app://note/other`;
        const references = extractNoteLinkReferences(content).sort((a, b) => a.from - b.from);
        expect(references.map(({ raw, label }) => [raw, label])).toEqual([
            [wrapped, "Old name"],
            ["app://note/other", "other"],
        ]);
        expect(references[0]!.to).toBeLessThan(references[1]!.from);
    });
    it.each([
        ["API_v2", "API_v2"],
        [String.raw`bracket \[one\] and \*star\*`, "bracket [one] and *star*"],
    ])("retains literal labels through repeated raw repairs: %s", (label, visible) => {
        const link = `[${label}](app://note/deleted "writeme-mention:deleted")`;
        let content = `${link} and ${link}\n\nKeep  this`;
        for (const target of ["first", "second"]) {
            const reference = extractNoteLinkReferences(content).find(({ target }) => target === "deleted")!;
            expect(reference.label).toBe(visible);
            const before = content;
            content = repairedMarkdown(content, {
                expectedContent: content,
                from: reference.from,
                to: reference.to,
                replacement: formatNoteMention(target, reference.label),
            })!;
            expect(content).toBe(
                before.slice(0, reference.from) + formatNoteMention(target, visible) + before.slice(reference.to),
            );
            expect(
                extractNoteLinkReferences(content)
                    .filter(({ target }) => target !== "deleted")
                    .map(({ label }) => label),
            ).toEqual(target === "first" ? [visible] : [visible, visible]);
            expect(content).toContain("Keep  this");
        }
    });
    it("preserves styled Markdown labels, escaped identities, titles and subpaths", () => {
        const [styled, marked] = extractNoteLinkReferences(
            '[**Visible**](app://note/missing#section "tooltip") [Marked](/note/unused "writeme-mention:a\\\"b")',
        );
        expect(styled).toMatchObject({
            label: "Visible",
            subpath: "#section",
            markdown: { label: "**Visible**", title: "tooltip" },
        });
        expect(marked).toMatchObject({ target: 'a"b', label: "Marked" });
    });
    it("keeps file mentions out of note repairs and uses complete Markdown link occurrences", () => {
        const source = makeNote(
            "source",
            "Source",
            '[README](docs/README.md "writeme-mention:file:docs/README.md") [Visible](app://note/missing) [Linked][ref]\n\n[ref]: app://note/other',
        );
        expect(
            findUnresolvedNoteLinks(source, [source]).map(({ reference }) => [
                reference.target,
                reference.raw,
                reference.label,
            ]),
        ).toEqual([
            ["missing", "[Visible](app://note/missing)", "Visible"],
            ["other", "[Linked][ref]", "Linked"],
        ]);
    });

    it("lists explicit workspace file mentions without treating them as note repairs", () => {
        const content = [
            '[README.md](projects/splinter/README.md "writeme-mention:file:projects/splinter/README.md")',
            '[maestro.md](ai/maestro.md "writeme-mention:file:ai/maestro.md")',
            '[missing.md](missing.md "writeme-mention:file:missing.md")',
            "[ordinary](ordinary.md)",
            '`[code](ignored.md "writeme-mention:file:ignored.md")`',
        ].join("\n\n");
        const source = makeNote("source", "Source", content);

        expect(
            extractWorkspaceFileReferences(content).map(({ label, path }) => [label, path]),
        ).toStrictEqual([
            ["README.md", "projects/splinter/README.md"],
            ["maestro.md", "ai/maestro.md"],
            ["missing.md", "missing.md"],
        ]);
        expect(findUnresolvedNoteLinks(source, [source])).toStrictEqual([]);
    });
    it("does not offer Markdown repairs inside structured notes or LaTeX sources", () => {
        const target = makeNote("target", "Target");
        for (const noteType of [NoteType.json, NoteType.excalidraw, NoteType.freehand, NoteType.pdf]) {
            const source = Note.parse({
                id: "source",
                title: "Source",
                noteType,
                content: '{"text":"Target [[Missing]]"}',
            });
            expect(findUnlinkedNoteMentions(target, [target, source])).toEqual([]);
            expect(findUnresolvedNoteLinks(source, [target, source])).toEqual([]);
        }
        const latex = makeNote("latex", "LaTeX", "Target [[Missing]]", "/workspace/source.tex");
        expect(findUnlinkedNoteMentions(target, [target, latex])).toEqual([]);
        expect(findUnresolvedNoteLinks(latex, [target, latex])).toEqual([]);
    });
    it("surfaces deleted ID targets and normal internal Markdown links for repair", () => {
        const source = makeNote(
            "source",
            "Source",
            '[Old name](/note/deleted "writeme-mention:deleted") and [Other](/note/other)',
        );
        const references = findUnresolvedNoteLinks(source, [source]);
        expect(references.map(({ reference }) => [reference.target, reference.label])).toEqual([
            ["deleted", "Old name"],
            ["other", "Other"],
        ]);
        const target = makeNote("other", "Renamed");
        expect(resolveNoteLinks(source, [source, target]).map(({ note }) => note.id)).toEqual(["other"]);
    });
    it("offers all duplicate matches and shares alias resolution without treating self-links as missing", () => {
        const current = makeNote("current", "Current", "[[Current]] [[Missing]] [[Alias]] [[Shared]] `[[Code]]`");
        const aliased = Note.parse({ id: "alias", title: "Canonical", metadata: { aliases: ["Alias"] } });
        const first = makeNote("first", "Shared");
        const second = makeNote("second", "Shared");
        const notes = [current, aliased, first, second];
        expect(
            findUnresolvedNoteLinks(current, notes).map(({ reference, candidates }) => [
                reference.target,
                candidates.map(({ id }) => id),
            ]),
        ).toEqual([
            ["Missing", []],
            ["Shared", ["first", "second"]],
        ]);
        expect(resolveNoteLinks(current, notes).map(({ note }) => note.id)).toEqual(["alias"]);
    });

    it("finds incoming Unicode title and alias occurrences with original offsets and excludes Markdown code and links", () => {
        const target = Note.parse({ id: "target", title: "Café", metadata: { aliases: ["東京"] } });
        const source = makeNote(
            "source",
            "Source",
            [
                "Cafe\u0301, Café and 東京. Not Caféine or 大東京.",
                "`Café` and ``東京 ` code``",
                "~~~md",
                "Café",
                "```",
                "東京",
                "~~~",
                "    Café",
                "[Café](https://example.com)",
                "[東京][ref]",
                "",
                "[ref]: https://example.com",
                "",
                "[[Café]]",
                "![東京](image.png)",
                "Text <a href='/note/target'>Café</a> and <code>東京</code>.",
            ].join("\n"),
        );
        const mentions = findUnlinkedNoteMentions(target, [target, source]);
        expect(mentions.map(({ text }) => text)).toEqual(["Cafe\u0301", "Café", "東京"]);
        for (const mention of mentions) expect(source.content.slice(mention.from, mention.to)).toBe(mention.text);
        expect(mentions[0]?.source.id).toBe("source");
        expect(mentions[0]?.excerpt).toContain("Cafe\u0301");
    });

    it("retains each identical missing reference as an explicit occurrence", () => {
        const source = makeNote("source", "Source", "[[Missing]] then [[Missing]]");
        expect(findUnresolvedNoteLinks(source, [source]).map(({ reference }) => reference.from)).toEqual([0, 17]);
    });

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
