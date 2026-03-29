import { describe, it, expect } from "vitest";
import { tokenize } from "../tokenizer";
import { TokenType } from "../ast";

describe("tokenizer", () => {
  it("tokenizes keywords case-insensitively", () => {
    const tokens = tokenize("SELECT WHERE AND OR NOT ORDER BY ASC DESC LIMIT");
    expect(tokens[0]!.type).toBe(TokenType.Select);
    expect(tokens[1]!.type).toBe(TokenType.Where);
    expect(tokens[2]!.type).toBe(TokenType.And);
    expect(tokens[3]!.type).toBe(TokenType.Or);
    expect(tokens[4]!.type).toBe(TokenType.Not);
    expect(tokens[5]!.type).toBe(TokenType.Order);
    expect(tokens[6]!.type).toBe(TokenType.By);
    expect(tokens[7]!.type).toBe(TokenType.Asc);
    expect(tokens[8]!.type).toBe(TokenType.Desc);
    expect(tokens[9]!.type).toBe(TokenType.Limit);
    expect(tokens[10]!.type).toBe(TokenType.EOF);
  });

  it("tokenizes identifier and dot notation", () => {
    const tokens = tokenize("metadata.author");
    expect(tokens[0]!).toMatchObject({
      type: TokenType.Identifier,
      value: "metadata",
    });
    expect(tokens[1]!).toMatchObject({ type: TokenType.Dot });
    expect(tokens[2]!).toMatchObject({
      type: TokenType.Identifier,
      value: "author",
    });
  });

  it("tokenizes string literals with double quotes", () => {
    const tokens = tokenize('"hello world"');
    expect(tokens[0]!).toMatchObject({
      type: TokenType.String,
      value: "hello world",
    });
  });

  it("tokenizes string literals with single quotes", () => {
    const tokens = tokenize("'book'");
    expect(tokens[0]!).toMatchObject({ type: TokenType.String, value: "book" });
  });

  it("tokenizes integer numbers", () => {
    const tokens = tokenize("42");
    expect(tokens[0]!).toMatchObject({ type: TokenType.Number, value: "42" });
  });

  it("tokenizes float numbers", () => {
    const tokens = tokenize("3.14");
    expect(tokens[0]!).toMatchObject({ type: TokenType.Number, value: "3.14" });
  });

  it("tokenizes operators", () => {
    const tokens = tokenize("= != > < >= <=");
    expect(tokens[0]!.type).toBe(TokenType.Eq);
    expect(tokens[1]!.type).toBe(TokenType.Neq);
    expect(tokens[2]!.type).toBe(TokenType.Gt);
    expect(tokens[3]!.type).toBe(TokenType.Lt);
    expect(tokens[4]!.type).toBe(TokenType.Gte);
    expect(tokens[5]!.type).toBe(TokenType.Lte);
  });

  it("tokenizes CONTAINS and STARTS_WITH keywords", () => {
    const tokens = tokenize("CONTAINS STARTS_WITH LIKE");
    expect(tokens[0]!.type).toBe(TokenType.Contains);
    expect(tokens[1]!.type).toBe(TokenType.StartsWith);
    expect(tokens[2]!.type).toBe(TokenType.Like);
  });

  it("tokenizes structural tokens", () => {
    const tokens = tokenize("( ) , . *");
    expect(tokens[0]!.type).toBe(TokenType.LParen);
    expect(tokens[1]!.type).toBe(TokenType.RParen);
    expect(tokens[2]!.type).toBe(TokenType.Comma);
    expect(tokens[3]!.type).toBe(TokenType.Dot);
    expect(tokens[4]!.type).toBe(TokenType.Star);
  });

  it("records positions", () => {
    const tokens = tokenize("title = 'test'");
    expect(tokens[0]!.position).toBe(0);
    expect(tokens[1]!.position).toBe(6);
    expect(tokens[2]!.position).toBe(8);
  });

  it("tokenizes true/false/null", () => {
    const tokens = tokenize("true false null");
    expect(tokens[0]!.type).toBe(TokenType.True);
    expect(tokens[1]!.type).toBe(TokenType.False);
    expect(tokens[2]!.type).toBe(TokenType.Null);
  });

  it("tokenizes JOIN INNER ON keywords", () => {
    const tokens = tokenize("JOIN INNER ON");
    expect(tokens[0]!.type).toBe(TokenType.Join);
    expect(tokens[1]!.type).toBe(TokenType.Inner);
    expect(tokens[2]!.type).toBe(TokenType.On);
    expect(tokens[3]!.type).toBe(TokenType.EOF);
  });

  it("tokenizes AS keyword", () => {
    const tokens = tokenize("title AS");
    expect(tokens[0]!.type).toBe(TokenType.Identifier);
    expect(tokens[1]!.type).toBe(TokenType.As);
  });

  it("tokenizes GROUP keyword", () => {
    const tokens = tokenize("GROUP BY");
    expect(tokens[0]!.type).toBe(TokenType.Group);
    expect(tokens[1]!.type).toBe(TokenType.By);
  });
});
