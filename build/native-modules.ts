import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const nativeModules = ["better-sqlite3", "node-pty"];
const intermediateDirectories = new Set([".deps", "obj.target"]);
const intermediateFile = /^(?:Makefile|config\.gypi)$|\.(?:mk|Makefile|o)$/;
// 64-bit and universal Mach-O files.
const machOMagic = new Set(["cffaedfe", "cafebabe"]);

function stripDebugSymbols(file: string): void {
    execFileSync("strip", ["-S", file], { stdio: "pipe" });
}

async function isMachO(file: string): Promise<boolean> {
    const handle = await fs.open(file);
    try {
        const { buffer } = await handle.read(Buffer.alloc(4), 0, 4, 0);
        return machOMagic.has(buffer.toString("hex"));
    } finally {
        await handle.close();
    }
}

async function clean(directory: string, strip: (file: string) => void): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            if (intermediateDirectories.has(entry.name)) {
                await fs.rm(target, { recursive: true });
            } else {
                await clean(target, strip);
            }
        } else if (entry.isFile()) {
            if (intermediateFile.test(entry.name)) {
                await fs.rm(target);
            } else if (await isMachO(target)) {
                strip(target);
            }
        }
    }
}

/**
 * Removes from the packaged native modules what names the folders of the machine that compiled them: the files of
 * node-gyp and the debug symbols of the binaries. A release is built on a personal Mac and published, so it must run
 * after the native rebuild and before the signing.
 */
export async function cleanNativeModules(buildPath: string, strip = stripDebugSymbols): Promise<void> {
    for (const name of nativeModules) {
        await clean(path.join(buildPath, "node_modules", name), strip);
    }
}
