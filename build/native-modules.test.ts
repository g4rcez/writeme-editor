// @vitest-environment node
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { cleanNativeModules } from "./native-modules.ts";

it("removes node-gyp files and strips only the Mach-O binaries of the packaged native modules", async () => {
    const buildPath = await mkdtemp(path.join(tmpdir(), "writeme-native-modules-"));
    const module = path.join(buildPath, "node_modules/node-pty");
    const machO = Buffer.from("cffaedfe00", "hex");
    const files: Array<[string, string | Buffer]> = [
        ["build/Release/pty.node", machO],
        ["build/Release/spawn-helper", machO],
        ["prebuilds/win32-x64/pty.node", "MZ"],
        ["lib/index.js", "export {};"],
        ["typings/node-pty.d.ts", "export {};"],
        ["build/Makefile", "/Users/someone"],
        ["build/config.gypi", "/Users/someone"],
        ["build/pty.target.mk", "/Users/someone"],
        ["build/Release/.deps/pty.o.d", "/Users/someone"],
        ["build/Release/obj.target/pty/pty.o", machO],
    ];
    try {
        for (const [file, content] of files) {
            await mkdir(path.dirname(path.join(module, file)), { recursive: true });
            await writeFile(path.join(module, file), content);
        }
        const stripped: Array<string> = [];

        await cleanNativeModules(buildPath, (file) => stripped.push(path.relative(module, file)));

        const kept = await Promise.all(
            files.map(async ([file]) =>
                (await access(path.join(module, file)).then(
                    () => true,
                    () => false,
                ))
                    ? file
                    : "",
            ),
        );
        expect(kept.filter(Boolean)).toEqual(files.slice(0, 5).map(([file]) => file));
        expect(stripped.toSorted()).toEqual(["build/Release/pty.node", "build/Release/spawn-helper"]);
    } finally {
        await rm(buildPath, { recursive: true, force: true });
    }
});
