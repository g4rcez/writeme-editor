import { describe, expect, it } from "vitest";
import { executeQuery } from "../engine";
import { parse } from "../parser";
import { astToFilterGroup, filterGroupToQueryString } from "../query-builder";

describe("visual numeric filters", () => {
    it.each(["1e3", "+1000", "0x3e8", ".5", "1e-7", "-1e21", "1e21", "5e-324"])(
        "serializes %s in the supported decimal grammar",
        (value) => {
            const group = astToFilterGroup(parse("WHERE fileSize = 0").where);
            if (!group) throw new Error("Expected editable numeric filter");
            group.filters[0]!.value = value;
            const query = filterGroupToQueryString(group, { orderBy: { field: "title", dir: "DESC" }, limit: 1 });
            const parsed = parse(query);
            expect(parsed.where).toMatchObject({ value: { type: "Number", value: Number(value) } });
            expect(
                executeQuery(parsed, { notes: [{ id: "match", title: "Match", fileSize: Number(value) }] }).map(
                    (row) => row["notes.id"],
                ),
            ).toEqual(["match"]);
            expect(parsed.orderBy).toMatchObject({ direction: "DESC", column: { path: ["title"] } });
            expect(parsed.limit).toBe(1);
        },
    );

    it.each(["1e", "-", "Infinity", "NaN"])("rejects numeric intermediate %s until corrected or removed", (value) => {
        const group = astToFilterGroup(parse("WHERE fileSize >= 10").where);
        if (!group) throw new Error("Expected editable numeric filter");
        group.filters[0]!.value = value;
        expect(() => filterGroupToQueryString(group)).toThrow("Enter a finite number");
        group.filters[0]!.value = "1000";
        expect(parse(filterGroupToQueryString(group)).where).toMatchObject({ value: { type: "Number", value: 1000 } });
        group.filters = [];
        expect(parse(filterGroupToQueryString(group)).where).toBeNull();
    });
});
