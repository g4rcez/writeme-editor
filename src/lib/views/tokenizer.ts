import type { Token } from "./ast";
import { TokenType } from "./ast";

const KEYWORDS: Record<string, TokenType> = {
  select: TokenType.Select,
  where: TokenType.Where,
  and: TokenType.And,
  or: TokenType.Or,
  not: TokenType.Not,
  order: TokenType.Order,
  by: TokenType.By,
  asc: TokenType.Asc,
  desc: TokenType.Desc,
  limit: TokenType.Limit,
  null: TokenType.Null,
  true: TokenType.True,
  false: TokenType.False,
  from: TokenType.From,
  contains: TokenType.Contains,
  starts_with: TokenType.StartsWith,
  like: TokenType.Like,
  join: TokenType.Join,
  inner: TokenType.Inner,
  on: TokenType.On,
  as: TokenType.As,
  group: TokenType.Group,
};

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const start = i;
    const ch = input[i]!;

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // String literals
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let value = "";
      while (i < input.length && input[i] !== quote) {
        if (input[i] === "\\" && i + 1 < input.length) {
          i++;
          value += input[i];
        } else {
          value += input[i];
        }
        i++;
      }
      if (i >= input.length) {
        throw new Error(`Unterminated string at position ${start}`);
      }
      i++; // consume closing quote
      tokens.push({ type: TokenType.String, value, position: start });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch) || (ch === "-" && /[0-9]/.test(input[i + 1] ?? ""))) {
      let value = "";
      if (ch === "-") {
        value += "-";
        i++;
      }
      while (i < input.length && /[0-9]/.test(input[i]!)) {
        value += input[i++];
      }
      if (i < input.length && input[i] === ".") {
        value += ".";
        i++;
        while (i < input.length && /[0-9]/.test(input[i]!)) {
          value += input[i++];
        }
      }
      tokens.push({ type: TokenType.Number, value, position: start });
      continue;
    }

    // Two-char operators
    if (i + 1 < input.length) {
      const two = input.slice(i, i + 2);
      if (two === "!=") {
        tokens.push({ type: TokenType.Neq, value: "!=", position: start });
        i += 2;
        continue;
      }
      if (two === ">=") {
        tokens.push({ type: TokenType.Gte, value: ">=", position: start });
        i += 2;
        continue;
      }
      if (two === "<=") {
        tokens.push({ type: TokenType.Lte, value: "<=", position: start });
        i += 2;
        continue;
      }
    }

    // Single-char operators/structural
    if (ch === "=") {
      tokens.push({ type: TokenType.Eq, value: "=", position: start });
      i++;
      continue;
    }
    if (ch === ">") {
      tokens.push({ type: TokenType.Gt, value: ">", position: start });
      i++;
      continue;
    }
    if (ch === "<") {
      tokens.push({ type: TokenType.Lt, value: "<", position: start });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: TokenType.LParen, value: "(", position: start });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: TokenType.RParen, value: ")", position: start });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: TokenType.Comma, value: ",", position: start });
      i++;
      continue;
    }
    if (ch === ".") {
      tokens.push({ type: TokenType.Dot, value: ".", position: start });
      i++;
      continue;
    }
    if (ch === "*") {
      tokens.push({ type: TokenType.Star, value: "*", position: start });
      i++;
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(ch)) {
      let value = "";
      while (i < input.length && /[a-zA-Z0-9_-]/.test(input[i]!)) {
        value += input[i++];
      }
      const lower = value.toLowerCase();
      const kwType = KEYWORDS[lower];
      tokens.push({
        type: kwType ?? TokenType.Identifier,
        value,
        position: start,
      });
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at position ${i}`);
  }

  tokens.push({ type: TokenType.EOF, value: "", position: i });
  return tokens;
}
