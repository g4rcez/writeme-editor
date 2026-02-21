import { describe, it, expect } from "vitest";
import { EXECUTION_CONFIG } from "./execution-config";

describe("EXECUTION_CONFIG browser runtime", () => {
  it("should have browserRuntimeExec for javascript", () => {
    const config = EXECUTION_CONFIG.javascript;
    expect(config?.browserRuntimeExec).toBeDefined();
  });

  it("should execute javascript in browser runtime", async () => {
    const config = EXECUTION_CONFIG.javascript;
    if (config?.browserRuntimeExec) {
      const result = await config.browserRuntimeExec("1 + 1");
      expect(result.stdout).toBe("2");
      expect(result.stderr).toBe("");
    }
  });

  it("should handle javascript errors in browser runtime", async () => {
    const config = EXECUTION_CONFIG.javascript;
    if (config?.browserRuntimeExec) {
      const result = await config.browserRuntimeExec("throw new Error('test error')");
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Error: test error");
    }
  });

  it("should have browserRuntimeExec for html", () => {
    const config = EXECUTION_CONFIG.html;
    expect(config?.browserRuntimeExec).toBeDefined();
  });

  it("should execute html in browser runtime", async () => {
    const config = EXECUTION_CONFIG.html;
    if (config?.browserRuntimeExec) {
      const code = "<h1>Hello</h1>";
      const result = await config.browserRuntimeExec(code);
      expect(result.html).toBe(code);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
    }
  });
});
