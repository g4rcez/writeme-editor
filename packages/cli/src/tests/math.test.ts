import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { appendMathHistory, handleExpr } from "../commands/math.ts";

const logSpy = spyOn(console, "log").mockImplementation(() => {});
const errorSpy = spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  logSpy.mockClear();
  errorSpy.mockClear();
  process.exitCode = undefined;
});

describe("handleExpr", () => {
  test("prints only the evaluated expression result", async () => {
    await handleExpr({ code: "1 + 1" });

    expect(logSpy).toHaveBeenCalledWith("2");
    expect(process.exitCode).toBeUndefined();
  });

  test("sets a failing exit code for invalid expressions", async () => {
    await handleExpr({ code: "totally bogus &&&" });

    expect(errorSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});

describe("appendMathHistory", () => {
  test("appends expressions to the history file", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "writeme-math-"));
    const historyPath = path.join(dir, "math-repl");

    try {
      await appendMathHistory("1 + 1", historyPath);
      await appendMathHistory("2 + 2", historyPath);

      await expect(readFile(historyPath, "utf8")).resolves.toBe(
        "1 + 1\n2 + 2\n",
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
