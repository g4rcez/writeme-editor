import type {
  AggregateFn,
  ColumnRef,
  ComparisonOp,
  Expression,
  JoinClause,
  LiteralValue,
  Query,
  SelectItem,
} from "./ast";

export type Row = Record<string, unknown>;
export type DataSources = Record<string, object[]>;

const DEFAULT_TABLE = "notes";

function prefixRow(tableName: string, obj: object): Row {
  const row: Row = {};
  for (const [key, value] of Object.entries(obj)) {
    row[`${tableName}.${key}`] = value;
  }
  return row;
}

export function resolveField(
  row: Row,
  column: ColumnRef,
  fromTable: string,
  queryTables: Set<string>,
): unknown {
  const path = column.path;
  let tableName: string;
  let fieldPath: string[];

  if (path.length > 1 && queryTables.has(path[0]!)) {
    tableName = path[0]!;
    fieldPath = path.slice(1);
  } else {
    tableName = fromTable;
    fieldPath = path;
  }

  const key = `${tableName}.${fieldPath[0]}`;
  let value: unknown = row[key];

  for (let i = 1; i < fieldPath.length; i++) {
    if (value == null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[fieldPath[i]!];
  }

  return value;
}

function literalToValue(
  literal: LiteralValue,
): string | number | boolean | null {
  switch (literal.type) {
    case "String":
      return literal.value;
    case "Number":
      return literal.value;
    case "Boolean":
      return literal.value;
    case "Null":
      return null;
  }
}

function coerceDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function compareValues(
  fieldValue: unknown,
  op: ComparisonOp,
  literalValue: LiteralValue,
): boolean {
  const rhs = literalToValue(literalValue);

  if (op === "CONTAINS") {
    if (Array.isArray(fieldValue)) return fieldValue.includes(rhs);
    if (typeof fieldValue === "string" && typeof rhs === "string")
      return fieldValue.toLowerCase().includes(rhs.toLowerCase());
    return false;
  }

  if (op === "STARTS_WITH") {
    if (typeof fieldValue === "string" && typeof rhs === "string")
      return fieldValue.toLowerCase().startsWith(rhs.toLowerCase());
    return false;
  }

  if (op === "LIKE") {
    if (typeof fieldValue === "string" && typeof rhs === "string") {
      const pattern = rhs
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/%/g, ".*")
        .replace(/_/g, ".");
      return new RegExp(`^${pattern}$`, "i").test(fieldValue);
    }
    return false;
  }

  if (rhs === null) return op === "=" ? fieldValue == null : fieldValue != null;
  if (fieldValue == null) return op === "!=" ? true : false;

  const fieldDate = coerceDate(fieldValue);
  if (fieldDate && literalValue.type === "String") {
    const rhsDate = coerceDate(rhs);
    if (rhsDate) {
      switch (op) {
        case "=":
          return fieldDate.getTime() === rhsDate.getTime();
        case "!=":
          return fieldDate.getTime() !== rhsDate.getTime();
        case ">":
          return fieldDate > rhsDate;
        case "<":
          return fieldDate < rhsDate;
        case ">=":
          return fieldDate >= rhsDate;
        case "<=":
          return fieldDate <= rhsDate;
      }
    }
  }

  if (typeof fieldValue === "boolean") {
    if (op === "=") return fieldValue === Boolean(rhs);
    if (op === "!=") return fieldValue !== Boolean(rhs);
    return false;
  }

  const lhsNum =
    typeof fieldValue === "number" ? fieldValue : Number(fieldValue);
  const rhsNum = typeof rhs === "number" ? rhs : Number(rhs);
  if (!isNaN(lhsNum) && !isNaN(rhsNum)) {
    switch (op) {
      case "=":
        return lhsNum === rhsNum;
      case "!=":
        return lhsNum !== rhsNum;
      case ">":
        return lhsNum > rhsNum;
      case "<":
        return lhsNum < rhsNum;
      case ">=":
        return lhsNum >= rhsNum;
      case "<=":
        return lhsNum <= rhsNum;
    }
  }

  const lhsStr = String(fieldValue);
  const rhsStr = String(rhs);
  switch (op) {
    case "=":
      return lhsStr.toLowerCase() === rhsStr.toLowerCase();
    case "!=":
      return lhsStr.toLowerCase() !== rhsStr.toLowerCase();
    case ">":
      return lhsStr > rhsStr;
    case "<":
      return lhsStr < rhsStr;
    case ">=":
      return lhsStr >= rhsStr;
    case "<=":
      return lhsStr <= rhsStr;
  }
}

function evaluateExpression(
  expr: Expression,
  row: Row,
  fromTable: string,
  queryTables: Set<string>,
): boolean {
  switch (expr.type) {
    case "BinaryLogical": {
      const left = evaluateExpression(expr.left, row, fromTable, queryTables);
      if (expr.op === "AND")
        return (
          left && evaluateExpression(expr.right, row, fromTable, queryTables)
        );
      if (expr.op === "OR")
        return (
          left || evaluateExpression(expr.right, row, fromTable, queryTables)
        );
      return false;
    }
    case "UnaryLogical":
      return !evaluateExpression(expr.expr, row, fromTable, queryTables);
    case "Group":
      return evaluateExpression(expr.expr, row, fromTable, queryTables);
    case "Comparison":
      return compareValues(
        resolveField(row, expr.field, fromTable, queryTables),
        expr.op,
        expr.value,
      );
  }
}

function compareFieldValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const aDate = coerceDate(a);
  const bDate = coerceDate(b);
  if (aDate && bDate) return aDate.getTime() - bDate.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function innerJoin(
  leftRows: Row[],
  join: JoinClause,
  dataSources: DataSources,
  fromTable: string,
  queryTables: Set<string>,
): Row[] {
  const rightData = dataSources[join.table] ?? [];
  const rightRows = rightData.map((obj) => prefixRow(join.table, obj));
  const result: Row[] = [];
  for (const left of leftRows) {
    for (const right of rightRows) {
      const merged = { ...left, ...right };
      const leftVal = resolveField(
        merged,
        join.on.left,
        fromTable,
        queryTables,
      );
      const rightVal = resolveField(
        merged,
        join.on.right,
        fromTable,
        queryTables,
      );
      if (
        leftVal != null &&
        rightVal != null &&
        String(leftVal) === String(rightVal)
      ) {
        result.push(merged);
      }
    }
  }
  return result;
}

function selectItemKey(
  item: SelectItem,
  fromTable: string,
  queryTables: Set<string>,
): string {
  if (item.type === "Column") {
    const path = item.path;
    if (path.length > 1 && queryTables.has(path[0]!)) {
      return path.join(".");
    }
    return `${fromTable}.${path.join(".")}`;
  }
  const colStr = item.column ? item.column.path.join(".") : "*";
  return `${item.fn}(${colStr})`;
}

function computeAggregate(
  fn: AggregateFn,
  column: ColumnRef | null,
  groupRows: Row[],
  fromTable: string,
  queryTables: Set<string>,
): unknown {
  if (fn === "COUNT") {
    if (!column) return groupRows.length;
    return groupRows.filter(
      (r) => resolveField(r, column, fromTable, queryTables) != null,
    ).length;
  }
  const values = groupRows
    .map((r) => resolveField(r, column!, fromTable, queryTables))
    .filter((v) => v != null)
    .map(Number)
    .filter((n) => !isNaN(n));
  if (values.length === 0) return null;
  switch (fn) {
    case "SUM":
      return values.reduce((a, b) => a + b, 0);
    case "AVG":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "MIN":
      return Math.min(...values);
    case "MAX":
      return Math.max(...values);
  }
}

function hasAggregates(items: SelectItem[]): boolean {
  return items.some((i) => i.type === "Aggregate");
}

function applyGroupBy(
  rows: Row[],
  query: Query,
  fromTable: string,
  queryTables: Set<string>,
): Row[] {
  const groupByCols = query.groupBy ?? [];
  const selectItems = query.select?.columns ?? [];
  const needsGrouping = query.groupBy || hasAggregates(selectItems);
  if (!needsGrouping) return rows;

  // Group rows
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = groupByCols
      .map((col) =>
        String(resolveField(row, col, fromTable, queryTables) ?? "NULL"),
      )
      .join("|||");
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  return Array.from(groups.values()).map((groupRows) => {
    const resultRow: Row = {};

    if (selectItems.length > 0) {
      for (const item of selectItems) {
        const key = selectItemKey(item, fromTable, queryTables);
        if (item.type === "Column") {
          resultRow[key] = resolveField(
            groupRows[0]!,
            item,
            fromTable,
            queryTables,
          );
        } else {
          resultRow[key] = computeAggregate(
            item.fn,
            item.column,
            groupRows,
            fromTable,
            queryTables,
          );
        }
        // Also store under alias for ORDER BY resolution
        const alias = item.alias;
        if (alias) resultRow[alias] = resultRow[key];
      }
    } else {
      // No SELECT: include GROUP BY columns + COUNT(*)
      for (const col of groupByCols) {
        const key = selectItemKey(col, fromTable, queryTables);
        resultRow[key] = resolveField(
          groupRows[0]!,
          col,
          fromTable,
          queryTables,
        );
      }
      resultRow["COUNT(*)"] = groupRows.length;
    }

    return resultRow;
  });
}

function resolveOrderByValue(
  row: Row,
  column: ColumnRef,
  fromTable: string,
  queryTables: Set<string>,
): unknown {
  const value = resolveField(row, column, fromTable, queryTables);
  if (value !== undefined) return value;
  // Fallback: direct key lookup (for aliases and aggregate keys)
  const directKey = column.path.join(".");
  if (directKey in row) return row[directKey];
  return undefined;
}

export function executeQuery(query: Query, dataSources: DataSources): Row[] {
  const fromTable = query.from ?? DEFAULT_TABLE;
  const queryTables = new Set([fromTable, ...query.joins.map((j) => j.table)]);
  const primaryData = dataSources[fromTable] ?? [];
  let rows: Row[] = primaryData.map((obj) => prefixRow(fromTable, obj));

  for (const join of query.joins) {
    rows = innerJoin(rows, join, dataSources, fromTable, queryTables);
  }

  if (query.where) {
    const where = query.where;
    rows = rows.filter((row) =>
      evaluateExpression(where, row, fromTable, queryTables),
    );
  }

  rows = applyGroupBy(rows, query, fromTable, queryTables);

  if (query.orderBy) {
    const { column, direction } = query.orderBy;
    const sign = direction === "DESC" ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      const av = resolveOrderByValue(a, column, fromTable, queryTables);
      const bv = resolveOrderByValue(b, column, fromTable, queryTables);
      return sign * compareFieldValues(av, bv);
    });
  }

  if (query.limit != null) {
    rows = rows.slice(0, query.limit);
  }

  return rows;
}
