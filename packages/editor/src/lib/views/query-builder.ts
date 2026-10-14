import type { ColumnRef, Comparison, ComparisonOp, Expression, LiteralValue } from "./ast";

export type FilterRow = {
    id: string;
    field: string;
    operator: ComparisonOp;
    value: string;
    valueType?: LiteralValue["type"];
};

export type FilterGroup = {
    id: string;
    logic: "AND" | "OR";
    filters: FilterRow[];
};

function columnRefToString(col: ColumnRef): string {
    return col.path.join(".");
}

export function quoteQueryString(value: string): string {
    return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function decimalLiteral(value: number): string {
    const text = String(value);
    const [coefficient, exponent] = text.split("e");
    if (exponent === undefined) return text;
    const sign = value < 0 ? "-" : "";
    const unsigned = coefficient!.replace("-", "");
    const digits = unsigned.replace(".", "");
    const point = (unsigned.indexOf(".") < 0 ? unsigned.length : unsigned.indexOf(".")) + Number(exponent);
    if (point <= 0) return `${sign}0.${"0".repeat(-point)}${digits}`;
    if (point >= digits.length) return `${sign}${digits}${"0".repeat(point - digits.length)}`;
    return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

function literalFromFilter(row: FilterRow): string {
    if (
        row.valueType === "String" ||
        (row.valueType === undefined && (row.field === "tags" || row.field === "notes.tags"))
    )
        return quoteQueryString(row.value);
    const num = Number(row.value);
    if (row.valueType === "Number" || row.field === "fileSize" || row.field === "notes.fileSize") {
        if (!Number.isFinite(num)) throw new Error("Enter a finite number for this filter.");
        return decimalLiteral(num);
    }
    if (row.value === "true") return "true";
    if (row.value === "false") return "false";
    if (row.value === "null") return "null";
    if (Number.isFinite(num) && row.value.trim() !== "") return decimalLiteral(num);
    return quoteQueryString(row.value);
}

export function filterGroupToQueryString(
    group: FilterGroup,
    options?: {
        select?: string[];
        orderBy?: { field: string; dir: "ASC" | "DESC" };
        limit?: number | null;
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
    if (options?.limit != null) parts.push(`LIMIT ${options.limit}`);
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
    return { id: crypto.randomUUID(), field, operator: comp.op, value, valueType: comp.value.type };
}
