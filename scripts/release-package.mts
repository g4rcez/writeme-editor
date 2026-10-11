import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

type PackageManifest = {
    name: string;
    version: string;
    private?: boolean;
    scripts?: Record<string, string>;
};

export type NpmRunner = (args: string[], directory: string) => void;

const usage = "Usage: pnpm release <package> <version> [--preid beta] [--tag next] [--allow-same-version] [--dry-run]";
const versionNames = new Set(["major", "minor", "patch", "premajor", "preminor", "prepatch", "prerelease", "from-git"]);

function readManifest(directory: string): PackageManifest {
    return JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as PackageManifest;
}

function runNpm(args: string[], directory: string): void {
    const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
        cwd: directory,
        stdio: "inherit",
        env: { ...process.env, npm_config_ignore_scripts: "false", npm_config_dry_run: "false" },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`npm ${args.join(" ")} failed (${result.status ?? result.signal}).`);
}

export function releasePackage(args: string[], repository: string, run: NpmRunner = runNpm): void {
    const { positionals, values } = parseArgs({
        args: args[0] === "--" ? args.slice(1) : args,
        allowPositionals: true,
        options: {
            preid: { type: "string" },
            tag: { type: "string" },
            "allow-same-version": { type: "boolean" },
            "dry-run": { type: "boolean" },
        },
    });
    const [selected, version] = positionals;
    if (positionals.length !== 2 || !selected || !/^[a-z][a-z0-9-]*$/.test(selected) || !version) {
        throw new Error(usage);
    }
    if (!versionNames.has(version) && !/^[v=]?\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(version)) {
        throw new Error(`Invalid npm version argument: ${version}. ${usage}`);
    }
    const directory = join(repository, "packages", selected);
    let manifest: PackageManifest;
    try {
        manifest = readManifest(directory);
    } catch {
        throw new Error(`Unknown package: ${selected}.`);
    }
    if (
        manifest.private !== false ||
        !manifest.scripts?.validate ||
        manifest.scripts.prepublishOnly !== "npm run validate"
    ) {
        throw new Error(`${selected} must be public and have validate and prepublishOnly scripts.`);
    }

    const versionArgs = ["version", version, "--workspaces=false", "--git-tag-version=false", "--ignore-scripts=false"];
    if (values.preid !== undefined) versionArgs.push(`--preid=${values.preid}`);
    if (values["allow-same-version"]) versionArgs.push("--allow-same-version");

    console.log(`Validating ${manifest.name} before release`);
    run(["run", "validate", "--workspaces=false", "--ignore-scripts=false"], directory);
    if (values["dry-run"]) {
        console.log(`Preview: npm ${versionArgs.join(" ")}`);
        console.log(
            `Preview: npm publish --workspaces=false --access public --ignore-scripts=false${values.tag ? ` --tag ${values.tag}` : " (prereleases use --tag next)"}`,
        );
        return;
    }

    run(versionArgs, directory);
    manifest = readManifest(directory);
    const tag = values.tag ?? (manifest.version.includes("-") ? "next" : "latest");
    console.log(`Publishing ${manifest.name}@${manifest.version} with tag ${tag}`);
    try {
        run(
            ["publish", "--workspaces=false", "--access", "public", "--ignore-scripts=false", `--tag=${tag}`],
            directory,
        );
    } catch (error) {
        throw new Error(
            `Publication failed; ${selected} remains at ${manifest.version}. Retry npm publish --workspaces=false --access public --tag=${tag} from ${directory}.`,
            { cause: error },
        );
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        releasePackage(process.argv.slice(2), fileURLToPath(new URL("../", import.meta.url)));
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
