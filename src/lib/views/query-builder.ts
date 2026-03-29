import type {
  BinaryLogical,
  ColumnRef,
  Comparison,
  ComparisonOp,
  Expression,
} from "./ast";

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

export function filterGroupToAST(group: FilterGroup): Expression | null {
  const comparisons = group.filters
    .filter((f) => f.field && f.value !== "")
    .map((f): Comparison => {
      const path = f.field.split(".");
      const field: ColumnRef = { type: "Column", path };
      let value: Comparison["value"];
      if (f.value === "null") {
        value = { type: "Null" };
      } else if (f.value === "true") {
        value = { type: "Boolean", value: true };
      } else if (f.value === "false") {
        value = { type: "Boolean", value: false };
      } else {
        const num = Number(f.value);
        if (!isNaN(num) && f.value !== "") {
          value = { type: "Number", value: num };
        } else {
          value = { type: "String", value: f.value };
        }
      }
      return { type: "Comparison", field, op: f.operator, value };
    });

  if (comparisons.length === 0) return null;
  if (comparisons.length === 1) return comparisons[0]!;

  return comparisons.slice(1).reduce<Expression>((acc, comp) => {
    const node: BinaryLogical = {
      type: "BinaryLogical",
      op: group.logic,
      left: acc,
      right: comp,
    };
    return node;
  }, comparisons[0]!);
}

function isSimpleComparison(expr: Expression): Comparison | null {
  if (expr.type === "Comparison") return expr;
  return null;
}

export function astToFilterGroup(
  expr: Expression | null,
  existingGroupId?: string,
): FilterGroup | null {
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
