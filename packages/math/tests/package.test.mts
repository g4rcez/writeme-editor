import assert from "node:assert/strict";
import { copyFileSync, lstatSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import {
    assertPackageContents,
    assertSuccess,
    installPackedPackages,
    runtimes,
    runCommand,
    typecheckConsumer,
    type PackedProject,
} from "./npm-package.mts";

let project: PackedProject;

before(() => {
    project = installPackedPackages(["@writeme.dev/math"]);
    copyFileSync(new URL("./runtime.mjs", import.meta.url), join(project.directory, "consumer.mjs"));
    copyFileSync(new URL("./consumer.ts", import.meta.url), join(project.directory, "consumer.ts"));
    const consumer = readFileSync(new URL("./runtime.mjs", import.meta.url), "utf8");
    writeFileSync(
        join(project.directory, "deno-consumer.mjs"),
        consumer.replaceAll('from "@writeme.dev/', 'from "npm:@writeme.dev/'),
    );
});

after(() => project?.cleanup());

test("math tarball ships all declared entry points without source files or workspace links", () => {
    assertPackageContents(project, "@writeme.dev/math");
    const directory = join(project.directory, "node_modules", "@writeme.dev", "math");
    assert.equal(lstatSync(directory).isSymbolicLink(), false);
    const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
    for (const entry of Object.values(manifest.exports) as { types: string; import: string }[]) {
        assert.ok(readFileSync(join(directory, entry.types)).length > 0);
        assert.ok(readFileSync(join(directory, entry.import)).length > 0);
    }
});

test("math declarations work in a strict TypeScript consumer without repository aliases", () => {
    typecheckConsumer(project.directory, "consumer.ts");
});

for (const runtime of runtimes) {
    test(`${runtime.name}: installed math package evaluates expressions and exported helpers`, () => {
        const consumer = runtime.name === "deno" ? "deno-consumer.mjs" : "consumer.mjs";
        const result = runCommand(runtime.name, [...runtime.flags, consumer], project.directory);
        assertSuccess(result);
        assert.equal(result.stdout.trim(), "math runtime passed");
    });
}
