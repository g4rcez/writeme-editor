import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getOrCreateAiProxyToken } from "./ai-proxy-token";

let userDataDirectory: string;

afterEach(() => {
    if (userDataDirectory) fs.rmSync(userDataDirectory, { recursive: true, force: true });
});

describe("getOrCreateAiProxyToken", () => {
    it("keeps the proxy token stable when the owner process restarts", () => {
        userDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "writeme-ai-proxy-"));

        const firstRunToken = getOrCreateAiProxyToken(userDataDirectory, "first-run-token");
        const restartedOwnerToken = getOrCreateAiProxyToken(userDataDirectory, "restarted-owner-token");

        expect(restartedOwnerToken).toBe(firstRunToken);
    });

    it("creates a token when the owner has no saved token", () => {
        userDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "writeme-ai-proxy-"));

        expect(getOrCreateAiProxyToken(userDataDirectory, "new-owner-token")).toBe("new-owner-token");
    });

    it("rejects an empty candidate token", () => {
        userDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "writeme-ai-proxy-"));

        expect(() => getOrCreateAiProxyToken(userDataDirectory, "  ")).toThrow("AI proxy token cannot be empty.");
    });
});
