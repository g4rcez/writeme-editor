export enum TokenType {
  // Keywords
  Select = "Select",
  Where = "Where",
  And = "And",
  Or = "Or",
  Not = "Not",
  Order = "Order",
  By = "By",
  Asc = "Asc",
  Desc = "Desc",
  Limit = "Limit",
  Null = "Null",
  True = "True",
  False = "False",
  From = "From",
  Join = "Join",
  Inner = "Inner",
  On = "On",
  As = "As",
  Group = "Group",
  // Operators
  Eq = "Eq",
  Neq = "Neq",
  Gt = "Gt",
  Lt = "Lt",
  Gte = "Gte",
  Lte = "Lte",
  Contains = "Contains",
  StartsWith = "StartsWith",
  Like = "Like",
  // Literals
  String = "String",
  Number = "Number",
  // Structural
  Comma = "Comma",
  LParen = "LParen",
  RParen = "RParen",
  Star = "Star",
  Dot = "Dot",
  // Other
  Identifier = "Identifier",
  EOF = "EOF",
}

export type Token = {
  type: TokenType;
  value: string;
  position: number;
};

export type ColumnRef = {
  type: "Column";
  path: string[];
  alias?: string;
};

export type AggregateFn = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";

export type AggregateRef = {
  type: "Aggregate";
  fn: AggregateFn;
  column: ColumnRef | null;
  alias?: string;
};

export type SelectItem = ColumnRef | AggregateRef;

export type SelectClause = {
  type: "Select";
  columns: SelectItem[];
};

export type ComparisonOp =
  | "="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "CONTAINS"
  | "STARTS_WITH"
  | "LIKE";

export type StringLiteral = { type: "String"; value: string };
export type NumberLiteral = { type: "Number"; value: number };
export type BooleanLiteral = { type: "Boolean"; value: boolean };
export type NullLiteral = { type: "Null" };

export type LiteralValue =
  | StringLiteral
  | NumberLiteral
  | BooleanLiteral
  | NullLiteral;

export type Comparison = {
  type: "Comparison";
  field: ColumnRef;
  op: ComparisonOp;
  value: LiteralValue;
};

export type BinaryLogical = {
  type: "BinaryLogical";
  op: "AND" | "OR";
  left: Expression;
  right: Expression;
};

export type UnaryLogical = {
  type: "UnaryLogical";
  op: "NOT";
  expr: Expression;
};

export type GroupExpression = {
  type: "Group";
  expr: Expression;
};

export type Expression =
  | BinaryLogical
  | UnaryLogical
  | Comparison
  | GroupExpression;

export type OrderByClause = {
  type: "OrderBy";
  column: ColumnRef;
  direction: "ASC" | "DESC";
};

export type JoinCondition = {
  type: "JoinCondition";
  left: ColumnRef;
  right: ColumnRef;
};

export type JoinClause = {
  type: "Join";
  table: string;
  on: JoinCondition;
};

export type Query = {
  type: "Query";
  select: SelectClause | null;
  from: string | null;
  joins: JoinClause[];
  where: Expression | null;
  groupBy: ColumnRef[] | null;
  orderBy: OrderByClause | null;
  limit: number | null;
};

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly position: number,
  ) {
    super(message);
    this.name = "ParseError";
  }
}
