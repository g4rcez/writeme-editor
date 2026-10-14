import { describe, expect, it } from "vitest";
import {
    decodeCodeResult,
    encodeCodeResult,
    fingerprintCode,
    MAX_CODE_RESULT_CHARS,
    parseCodeExecutionResult,
    stripCodeResultMetadata,
    type CodeExecutionResult,
} from "./code-result";

const result: CodeExecutionResult = {
    version: 1,
    executedAt: "2026-10-14T12:30:00.000Z",
    language: "javascript",
    sourceFingerprint: "a".repeat(64),
    stdout: "line one\n🌱",
    stderr: "warning",
};

describe("kept code execution results", () => {
    it("omits result metadata from note previews while preserving source and prose", () => {
        expect(
            stripCodeResultMetadata(
                `Intro\n\n<!-- writeme-code-result:v1:${encodeCodeResult(result)} -->\n\`\`\`javascript\n2 + 2\n\`\`\``,
            ),
        ).toBe("Intro\n\n```javascript\n2 + 2\n```");
    });

    it("roundtrips Unicode stdout, stderr, language, timestamp, and fingerprint", () => {
        expect(decodeCodeResult(encodeCodeResult(result))).toStrictEqual(result);
        expect(parseCodeExecutionResult(JSON.stringify(result))).toStrictEqual(result);
    });

    it("rejects malformed, oversized, and unsupported result records", () => {
        expect(decodeCodeResult("not-base64-json")).toBeNull();
        expect(parseCodeExecutionResult(JSON.stringify({ ...result, version: 2 }))).toBeNull();
        expect(
            parseCodeExecutionResult(
                JSON.stringify({ ...result, stdout: "x".repeat(MAX_CODE_RESULT_CHARS + 1), stderr: "" }),
            ),
        ).toBeNull();
        expect(parseCodeExecutionResult("{} ")).toBeNull();
    });

    it("fingerprints exact source text and changes with source edits", async () => {
        const original = await fingerprintCode("print('hi')\n");
        expect(original).toBe(await fingerprintCode("print('hi')\n"));
        expect(original).not.toBe(await fingerprintCode("print('hi')"));
        expect(original).toMatch(/^[a-f0-9]{64}$/);
    });
});
