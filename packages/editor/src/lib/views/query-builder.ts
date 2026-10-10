import type { ColumnRef, Comparison, ComparisonOp, Expression } from "./ast";

export type FilterRow = {
    id: string;
    field: string;
    operator: ComparisonOp;
    value: string;
};

export type FilterGroup = {
    id: string;
    logic: "AND" | "OR";
    filters: FilterRow[];
};

function columnRefToString(col: ColumnRef): string {
    return col.path.join(".");
}

function literalFromFilter(row: FilterRow): string {
    const num = Number(row.value);
    if (row.value === "true") return "true";
    if (row.value === "false") return "false";
    if (row.value === "null") return "null";
    if (!isNaN(num) && row.value !== "") return row.value;
    return `'${row.value.replace(/'/g, "\\'")}'`;
}

export function filterGroupToQueryString(
    group: FilterGroup,
    options?: {
        select?: string[];
        orderBy?: { field: string; dir: "ASC" | "DESC" };
    },
): string {
    const parts: string[] = [];
    if (options?.select && options.select.length > 0) {
        parts.push(`SELECT ${options.select.join(", ")}`);
    }
    if (group.filters.length > 0) {
        const conditions = group.filters
            .filter((f) => f.field && f.value !== "")
            .map((f) => `${f.field} ${f.operator} ${literalFromFilter(f)}`);
        if (conditions.length > 0) {
            parts.push(`WHERE ${conditions.join(` ${group.logic} `)}`);
        }
    }
    if (options?.orderBy) {
        parts.push(`ORDER BY ${options.orderBy.field} ${options.orderBy.dir}`);
    }
    return parts.join("\n");
}

function isSimpleComparison(expr: Expression): Comparison | null {
    if (expr.type === "Comparison") return expr;
    return null;
}

export function astToFilterGroup(expr: Expression | null, existingGroupId?: string): FilterGroup | null {
    if (!expr) {
        return {
            id: existingGroupId ?? crypto.randomUUID(),
            logic: "AND",
            filters: [],
        };
    }

    const groupId = existingGroupId ?? crypto.randomUUID();

    const comp = isSimpleComparison(expr);
    if (comp) {
        return {
            id: groupId,
            logic: "AND",
            filters: [comparisonToFilterRow(comp)],
        };
    }

    if (expr.type !== "BinaryLogical") return null;

    const logic = expr.op;
    const filters: FilterRow[] = [];
    let current: Expression = expr;

    while (current.type === "BinaryLogical" && current.op === logic) {
        const rightComp = isSimpleComparison(current.right);
        if (!rightComp) return null;
        filters.unshift(comparisonToFilterRow(rightComp));
        current = current.left;
    }

    const leftComp = isSimpleComparison(current);
    if (!leftComp) return null;
    filters.unshift(comparisonToFilterRow(leftComp));

    return { id: groupId, logic, filters };
}

function comparisonToFilterRow(comp: Comparison): FilterRow {
    const field = columnRefToString(comp.field);
    let value: string;
    switch (comp.value.type) {
        case "String":
            value = comp.value.value;
            break;
        case "Number":
            value = String(comp.value.value);
            break;
        case "Boolean":
            value = String(comp.value.value);
            break;
        case "Null":
            value = "null";
            break;
    }
    return { id: crypto.randomUUID(), field, operator: comp.op, value };
}
