import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const TOKEN_DIRECTORY = "ai-proxy";
const TOKEN_FILE = "workspace-token";

export function getOrCreateAiProxyToken(userDataDirectory: string, candidateToken: string): string {
    if (!candidateToken.trim()) throw new Error("AI proxy token cannot be empty.");

    const tokenDirectory = path.join(userDataDirectory, TOKEN_DIRECTORY);
    fs.mkdirSync(tokenDirectory, { recursive: true, mode: 0o700 });
    if (!fs.lstatSync(tokenDirectory).isDirectory()) {
        throw new Error("AI proxy token path must be a directory.");
    }
    fs.chmodSync(tokenDirectory, 0o700);

    const tokenPath = path.join(tokenDirectory, TOKEN_FILE);
    try {
        if (!fs.lstatSync(tokenPath).isFile()) {
            throw new Error("AI proxy token path must be a file.");
        }
        fs.chmodSync(tokenPath, 0o600);
        const savedToken = fs.readFileSync(tokenPath, "utf8").trim();
        if (savedToken) return savedToken;
    } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }

    const temporaryPath = path.join(tokenDirectory, `.${TOKEN_FILE}-${randomUUID()}.tmp`);
    try {
        fs.writeFileSync(temporaryPath, candidateToken, { encoding: "utf8", flag: "wx", mode: 0o600 });
        fs.renameSync(temporaryPath, tokenPath);
        fs.chmodSync(tokenPath, 0o600);
    } finally {
        fs.rmSync(temporaryPath, { force: true });
    }

    return candidateToken;
}
