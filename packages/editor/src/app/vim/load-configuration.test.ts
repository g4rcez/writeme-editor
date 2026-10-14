import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultVimConfiguration } from "./configuration";

const compile = vi.hoisted(() => vi.fn());
vi.mock("./scripts/compile", () => ({ compileVimConfiguration: compile }));

beforeEach(() => {
    vi.resetModules();
    compile.mockReset();
});

describe("Vim configuration loading", () => {
    it("retries the same source after a failed worker instead of retaining a rejected promise", async () => {
        const configuration = defaultVimConfiguration();
        compile.mockRejectedValueOnce(new Error("Worker failed")).mockResolvedValueOnce(configuration);
        const { loadVimConfiguration } = await import("./load-configuration");
        await expect(loadVimConfiguration("vim.opt.timeout = 500;")).rejects.toThrow("Worker failed");
        await expect(loadVimConfiguration("vim.opt.timeout = 500;")).resolves.toEqual(configuration);
        expect(compile).toHaveBeenCalledTimes(2);
    });
});
