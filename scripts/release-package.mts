import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { nextReleaseVersion } from "./release-version.mjs";

type PackageManifest = {
    name: string;
    version: string;
    private?: boolean;
    scripts?: Record<string, string>;
};

type PackageRelease = {
    directory: string;
    name: string;
    currentVersion: string;
    nextVersion: string;
};

export type NpmRunner = (args: string[], directory: string) => void;

const packageDirectories = ["math", "cli", "mcp"] as const;
const usage = "Usage: pnpm release <patch|minor|major> [--dry-run]";
const bumpTypes = new Set(["major", "minor", "patch"]);

function readManifest(directory: string): PackageManifest {
    return JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as PackageManifest;
}


function assertReleaseCheckout(repository: string): void {
    const branch = spawnSync("git", ["branch", "--show-current"], { cwd: repository, encoding: "utf8" });
    if (branch.error) throw branch.error;
    if (branch.status !== 0 || branch.stdout.trim() !== "main") {
        throw new Error("Package releases must run from the main branch.");
    }

    const status = spawnSync("git", ["status", "--porcelain"], { cwd: repository, encoding: "utf8" });
    if (status.error) throw status.error;
    if (status.status !== 0 || status.stdout.trim()) {
        throw new Error("Commit or stash worktree changes before publishing packages.");
    }
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

function readReleases(repository: string, bump: string): PackageRelease[] {
    return packageDirectories.map((packageDirectory) => {
        const directory = join(repository, "packages", packageDirectory);
        let manifest: PackageManifest;
        try {
            manifest = readManifest(directory);
        } catch {
            throw new Error(`Could not read the ${packageDirectory} package manifest.`);
        }
        if (
            manifest.private !== false ||
            !manifest.name ||
            !manifest.scripts?.validate ||
            manifest.scripts.prepublishOnly !== "npm run validate"
        ) {
            throw new Error(`${packageDirectory} must be public and have validate and prepublishOnly scripts.`);
        }
        return {
            directory,
            name: manifest.name,
            currentVersion: manifest.version,
            nextVersion: nextReleaseVersion(manifest.version, bump),
        };
    });
}

export function releasePackages(args: string[], repository: string, run: NpmRunner = runNpm): void {
    const { positionals, values } = parseArgs({
        args: args[0] === "--" ? args.slice(1) : args,
        allowPositionals: true,
        options: { "dry-run": { type: "boolean" } },
    });
    const [bump] = positionals;
    if (positionals.length !== 1 || !bump || !bumpTypes.has(bump)) {
        throw new Error(usage);
    }

    const releases = readReleases(repository, bump);
    if (!values["dry-run"]) assertReleaseCheckout(repository);

    for (const release of releases) {
        console.log(`Validating ${release.name}@${release.currentVersion}`);
        run(["run", "validate", "--workspaces=false", "--ignore-scripts=false"], release.directory);
    }

    if (values["dry-run"]) {
        for (const release of releases) {
            console.log(`Preview: npm version ${bump} --workspaces=false --git-tag-version=false in ${release.directory}`);
            console.log(
                `Preview: npm publish --workspaces=false --access public --ignore-scripts=false --tag=latest in ${release.directory}`,
            );
        }
        return;
    }

    for (const release of releases) {
        console.log(`Bumping ${release.name} from ${release.currentVersion} to ${release.nextVersion}`);
        try {
            run(
                ["version", bump, "--workspaces=false", "--git-tag-version=false", "--ignore-scripts=false"],
                release.directory,
            );
        } catch (error) {
            throw new Error(
                `Could not bump ${release.name}. No packages have been published; earlier package manifests may already be bumped.`,
                { cause: error },
            );
        }
        const updated = readManifest(release.directory);
        if (updated.version !== release.nextVersion) {
            throw new Error(
                `npm version produced ${updated.version} for ${release.name}; expected ${release.nextVersion}. No packages have been published.`,
            );
        }
    }

    for (const [index, release] of releases.entries()) {
        console.log(`Publishing ${release.name}@${release.nextVersion}`);
        try {
            run(
                ["publish", "--workspaces=false", "--access", "public", "--ignore-scripts=false", "--tag=latest"],
                release.directory,
            );
        } catch (error) {
            const alreadyPublished = releases.slice(0, index).map(({ name }) => name);
            const remaining = releases.slice(index).map(({ name, directory }) => `${name} from ${directory}`);
            throw new Error(
                `Publishing ${release.name} failed. Already published: ${alreadyPublished.join(", ") || "none"}. ` +
                    `All package versions are bumped; retry publication for: ${remaining.join("; ")}.`,
                { cause: error },
            );
        }
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        releasePackages(process.argv.slice(2), fileURLToPath(new URL("../", import.meta.url)));
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
