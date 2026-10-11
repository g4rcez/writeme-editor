import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), "writeme-independent-"));
const npm = process.env.npm_execpath;
assert.ok(npm, "Run this check with npm run test:packages:independent.");
const environment = {
    ...process.env,
    NODE_PATH: "",
    NODE_OPTIONS: "",
    PATH: process.env.PATH?.split(delimiter)
        .filter((entry) => !resolve(entry).startsWith(repository))
        .join(delimiter),
};

async function run(directory: string, args: string[]): Promise<void> {
    const status = await new Promise<number | null>((resolveStatus, reject) => {
        const child = spawn(process.execPath, [npm!, ...args, "--workspaces=false"], {
            cwd: directory,
            env: environment,
            stdio: "inherit",
        });
        child.once("error", reject);
        child.once("close", resolveStatus);
    });
    assert.equal(status, 0, `npm ${args.join(" ")} failed in ${directory}`);
}

try {
    let mathTarball: string | undefined;
    for (const name of ["math", "cli", "mcp"]) {
        console.log(`Validating ${name} outside the repository`);
        const directory = join(temporary, name);
        cpSync(join(repository, "packages", name), directory, {
            recursive: true,
            filter: (path) => !["node_modules", "dist", ".omo", "bun.lockb"].includes(basename(path)),
        });
        const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
        assert.equal(manifest.scripts.prepublishOnly, "npm run validate");
        const installation = ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--prefer-offline"];
        if (name === "cli") {
            assert.ok(mathTarball);
            installation.push("--no-save", "--package-lock=false", mathTarball);
        }
        await run(directory, installation);
        await run(directory, ["publish", "--dry-run", "--access", "public"]);
        if (name === "math") {
            await run(directory, ["pack", "--pack-destination", temporary]);
            const filename = readdirSync(temporary).find((entry) => entry.endsWith(".tgz"));
            assert.ok(filename);
            mathTarball = join(temporary, filename);
        }
        appendFileSync(join(directory, "src", "index.ts"), '\nexport const prepublishBroken: number = "invalid";\n');
        const rejected = spawnSync(process.execPath, [npm, "publish", "--dry-run", "--workspaces=false"], {
            cwd: directory,
            env: environment,
            encoding: "utf8",
            timeout: 60_000,
        });
        assert.ifError(rejected.error);
        assert.notEqual(rejected.status, 0, `${name} must reject a broken release`);
        assert.match(rejected.stdout + rejected.stderr, /prepublishOnly/);
        console.log(`${name}: independent validation passed; broken release rejected by prepublishOnly`);
    }
} finally {
    rmSync(temporary, { recursive: true, force: true });
}
