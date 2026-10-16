import { describe, expect, it } from "vitest";
import { Note, NoteType } from "@/store/note";
import { getMissingStarterViews } from "./starter-views";
import { executeQuery } from "./views/engine";
import { parse } from "./views/parser";
import { astToFilterGroup, filterGroupToQueryString } from "./views/query-builder";

describe("starter Views", () => {
    it("offers useful queries with deterministic IDs without duplicating or overwriting edited Views", () => {
        const starters = getMissingStarterViews([], new Date());
        expect(starters.map((view) => view.title)).toEqual(["Recently edited", "Reading queue"]);
        expect(getMissingStarterViews(starters, new Date())).toEqual([]);
        const edited = starters.map((view) => ({ ...view, title: "My View", query: "WHERE favorite = true" }));
        expect(getMissingStarterViews(edited, new Date())).toEqual([]);
        expect(
            getMissingStarterViews([{ ...starters[0]!, id: "existing-custom-id" }], new Date()).map(
                (view) => view.title,
            ),
        ).toEqual(["Reading queue"]);
    });

    it("sorts recent notes, limits them to 20 and includes only reading notes in the queue", () => {
        const notes = Array.from({ length: 25 }, (_, i) =>
            Note.parse({
                id: `note-${i}`,
                updatedAt: new Date(2026, 9, i + 1),
                noteType: i % 2 ? NoteType.note : NoteType["read-it-later"],
            }),
        );
        const starters = getMissingStarterViews([], new Date());
        const recent = executeQuery(parse(starters[0]!.query), { notes });
        expect(recent).toHaveLength(20);
        expect(recent[0]?.["notes.id"]).toBe("note-24");
        expect(recent[19]?.["notes.id"]).toBe("note-5");
        const parsed = parse(starters[0]!.query);
        const group = astToFilterGroup(parsed.where);
        if (!group || !parsed.orderBy) throw new Error("Expected simple starter query");
        const edited = filterGroupToQueryString(group, {
            orderBy: { field: parsed.orderBy.column.path.join("."), dir: parsed.orderBy.direction },
            limit: parsed.limit,
        });
        expect(executeQuery(parse(edited), { notes })).toEqual(recent);
        const reading = executeQuery(parse(starters[1]!.query), { notes });
        expect(reading).toHaveLength(13);
        expect(reading.every((row) => row["notes.noteType"] === "read-it-later")).toBe(true);
    });
});
