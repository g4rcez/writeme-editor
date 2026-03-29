import type {
  AggregateFn,
  AggregateRef,
  BinaryLogical,
  ColumnRef,
  Comparison,
  ComparisonOp,
  Expression,
  GroupExpression,
  JoinClause,
  LiteralValue,
  OrderByClause,
  Query,
  SelectClause,
  SelectItem,
  Token,
  UnaryLogical,
} from "./ast";
import { ParseError, TokenType } from "./ast";

const AGGREGATE_FNS = new Set<string>(["COUNT", "SUM", "AVG", "MIN", "MAX"]);
import { tokenize } from "./tokenizer";

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(input: string) {
    this.tokens = tokenize(input);
  }

  private peek(): Token {
    return this.tokens[this.pos]!;
  }

  private advance(): Token {
    const t = this.tokens[this.pos]!;
    if (t.type !== TokenType.EOF) this.pos++;
    return t;
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private expect(type: TokenType): Token {
    const t = this.peek();
    if (t.type !== type) {
      throw new ParseError(
        `Expected ${type} but got '${t.value}' (${t.type})`,
        t.position,
      );
    }
    return this.advance();
  }

  parse(): Query {
    const query: Query = {
      type: "Query",
      select: null,
      from: null,
      joins: [],
      where: null,
      groupBy: null,
      orderBy: null,
      limit: null,
    };

    if (this.check(TokenType.Select)) {
      query.select = this.parseSelect();
    }

    if (this.check(TokenType.From)) {
      this.advance();
      if (this.check(TokenType.Identifier)) {
        query.from = this.advance().value;
      }
    }

    while (this.check(TokenType.Join) || this.check(TokenType.Inner)) {
      if (this.check(TokenType.Inner)) {
        this.advance();
      }
      this.expect(TokenType.Join);
      const table = this.expect(TokenType.Identifier).value;
      this.expect(TokenType.On);
      const left = this.parseColumnRef();
      this.expect(TokenType.Eq);
      const right = this.parseColumnRef();
      query.joins.push({
        type: "Join",
        table,
        on: { type: "JoinCondition", left, right },
      } satisfies JoinClause);
    }

    if (this.check(TokenType.Where)) {
      this.advance(); // consume WHERE
      query.where = this.parseExpression();
    }

    if (this.check(TokenType.Group)) {
      this.advance(); // consume GROUP
      this.expect(TokenType.By);
      const cols: ColumnRef[] = [this.parseColumnRef()];
      while (this.check(TokenType.Comma)) {
        this.advance();
        cols.push(this.parseColumnRef());
      }
      query.groupBy = cols;
    }

    if (this.check(TokenType.Order)) {
      query.orderBy = this.parseOrderBy();
    }

    if (this.check(TokenType.Limit)) {
      this.advance(); // consume LIMIT
      const num = this.expect(TokenType.Number);
      query.limit = parseFloat(num.value);
    }

    if (!this.check(TokenType.EOF)) {
      const t = this.peek();
      throw new ParseError(`Unexpected token '${t.value}'`, t.position);
    }

    return query;
  }

  private parseSelect(): SelectClause {
    this.advance(); // consume SELECT
    if (this.check(TokenType.Star)) {
      this.advance();
      return { type: "Select", columns: [] };
    }
    const columns: SelectItem[] = [this.parseSelectItem()];
    while (this.check(TokenType.Comma)) {
      this.advance();
      columns.push(this.parseSelectItem());
    }
    return { type: "Select", columns };
  }

  private parseSelectItem(): SelectItem {
    // Check for aggregate function: identifier followed by (
    if (
      this.check(TokenType.Identifier) &&
      this.tokens[this.pos + 1]?.type === TokenType.LParen
    ) {
      const fnName = this.peek().value.toUpperCase();
      if (AGGREGATE_FNS.has(fnName)) {
        this.advance(); // consume function name
        this.advance(); // consume (
        let column: ColumnRef | null = null;
        if (this.check(TokenType.Star)) {
          this.advance();
        } else {
          column = this.parseColumnRef();
        }
        this.expect(TokenType.RParen);
        const agg: AggregateRef = {
          type: "Aggregate",
          fn: fnName as AggregateFn,
          column,
        };
        if (this.check(TokenType.As)) {
          this.advance();
          agg.alias = this.check(TokenType.String)
            ? this.advance().value
            : this.expect(TokenType.Identifier).value;
        }
        return agg;
      }
    }
    // Regular column
    const col = this.parseColumnRef();
    if (this.check(TokenType.As)) {
      this.advance();
      col.alias = this.check(TokenType.String)
        ? this.advance().value
        : this.expect(TokenType.Identifier).value;
    }
    return col;
  }

  private parseColumnRef(): ColumnRef {
    const first = this.expect(TokenType.Identifier);
    const path = [first.value];
    while (this.check(TokenType.Dot)) {
      this.advance(); // consume dot
      const part = this.expect(TokenType.Identifier);
      path.push(part.value);
    }
    return { type: "Column", path };
  }

  private parseOrderBy(): OrderByClause {
    this.advance(); // consume ORDER
    this.expect(TokenType.By);
    const column = this.parseColumnRef();
    let direction: "ASC" | "DESC" = "ASC";
    if (this.check(TokenType.Desc)) {
      this.advance();
      direction = "DESC";
    } else if (this.check(TokenType.Asc)) {
      this.advance();
      direction = "ASC";
    }
    return { type: "OrderBy", column, direction };
  }

  private parseExpression(): Expression {
    return this.parseOrExpr();
  }

  private parseOrExpr(): Expression {
    let left = this.parseAndExpr();
    while (this.check(TokenType.Or)) {
      this.advance();
      const right = this.parseAndExpr();
      const node: BinaryLogical = {
        type: "BinaryLogical",
        op: "OR",
        left,
        right,
      };
      left = node;
    }
    return left;
  }

  private parseAndExpr(): Expression {
    let left = this.parseUnaryExpr();
    while (this.check(TokenType.And)) {
      this.advance();
      const right = this.parseUnaryExpr();
      const node: BinaryLogical = {
        type: "BinaryLogical",
        op: "AND",
        left,
        right,
      };
      left = node;
    }
    return left;
  }

  private parseUnaryExpr(): Expression {
    if (this.check(TokenType.Not)) {
      this.advance();
      const expr = this.parseUnaryExpr();
      const node: UnaryLogical = {
        type: "UnaryLogical",
        op: "NOT",
        expr,
      };
      return node;
    }
    if (this.check(TokenType.LParen)) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TokenType.RParen);
      const node: GroupExpression = { type: "Group", expr };
      return node;
    }
    return this.parseComparison();
  }

  private parseComparison(): Comparison {
    const field = this.parseColumnRef();
    const op = this.parseOperator();
    const value = this.parseLiteral();
    return { type: "Comparison", field, op, value };
  }

  private parseOperator(): ComparisonOp {
    const t = this.peek();
    switch (t.type) {
      case TokenType.Eq:
        this.advance();
        return "=";
      case TokenType.Neq:
        this.advance();
        return "!=";
      case TokenType.Gt:
        this.advance();
        return ">";
      case TokenType.Lt:
        this.advance();
        return "<";
      case TokenType.Gte:
        this.advance();
        return ">=";
      case TokenType.Lte:
        this.advance();
        return "<=";
      case TokenType.Contains:
        this.advance();
        return "CONTAINS";
      case TokenType.StartsWith:
        this.advance();
        return "STARTS_WITH";
      case TokenType.Like:
        this.advance();
        return "LIKE";
      default:
        throw new ParseError(
          `Expected operator but got '${t.value}'`,
          t.position,
        );
    }
  }

  private parseLiteral(): LiteralValue {
    const t = this.peek();
    switch (t.type) {
      case TokenType.String:
        this.advance();
        return { type: "String", value: t.value };
      case TokenType.Number:
        this.advance();
        return { type: "Number", value: parseFloat(t.value) };
      case TokenType.True:
        this.advance();
        return { type: "Boolean", value: true };
      case TokenType.False:
        this.advance();
        return { type: "Boolean", value: false };
      case TokenType.Null:
        this.advance();
        return { type: "Null" };
      default:
        throw new ParseError(`Expected value but got '${t.value}'`, t.position);
    }
  }
}

export function parse(input: string): Query {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      type: "Query",
      select: null,
      from: null,
      joins: [],
      where: null,
      groupBy: null,
      orderBy: null,
      limit: null,
    };
  }
  try {
    return new Parser(trimmed).parse();
  } catch (e) {
    if (e instanceof ParseError) throw e;
    throw new ParseError((e as Error).message, 0);
  }
}
