import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type Step = { id?: string; uses?: string; run?: string; with?: Record<string, unknown> };
type Workflow = {
    jobs: Record<string, { uses?: string; needs?: string[]; with?: Record<string, unknown>; steps?: Step[] }>;
};

async function workflow(name: string): Promise<Workflow> {
    return parse(await readFile(path.resolve(".github/workflows", `${name}.yml`), "utf8")) as Workflow;
}

async function runStep(
    platform: string,
    id: string,
    cwd: string,
    env: Record<string, string>,
): Promise<SpawnSyncReturns<string>> {
    const steps = (await workflow(`build-${platform}`)).jobs.build?.steps;
    const command = steps?.find((step) => step.id === id)?.run;
    if (!command) throw new Error(`Missing ${platform} ${id} step`);
    return spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", command], {
        cwd,
        env: { ...process.env, ...env },
        encoding: "utf8",
        timeout: 10_000,
    });
}

it("requires and downloads both mobile builds before publishing a release", async () => {
    const { jobs } = await workflow("release");
    for (const platform of ["android", "ios"]) {
        const job = `build-${platform}`;
        expect(jobs[job]?.uses).toBe(`./.github/workflows/${job}.yml`);
        expect(jobs[job]?.with?.release).toBe(true);
        expect(jobs.release?.needs).toContain(job);
        expect(jobs.release?.steps).toContainEqual({
            uses: "actions/download-artifact@v4",
            with: { name: platform, path: "artifacts" },
        });
        const build = (await workflow(job)).jobs.build;
        expect(build?.steps?.find((step) => step.uses === "actions/upload-artifact@v4")?.with).toEqual({
            name: `\${{ inputs.release && '${platform}' || 'build-${platform}' }}`,
            path: "release-artifacts/",
            "if-no-files-found": "error",
        });
    }
    expect(jobs.release?.steps?.find((step) => step.uses === "softprops/action-gh-release@v2")?.with?.files).toBe(
        "artifacts/**",
    );
});

describe.runIf(process.platform !== "win32")("mobile artifact staging", () => {
    it.each(["android", "ios"])("checks %s release versions while allowing branch builds", async (platform) => {
        const directory = await mkdtemp(path.join(tmpdir(), "writeme-mobile-version-"));
        const envFile = path.join(directory, "github-env");
        try {
            await writeFile(path.join(directory, "package.json"), JSON.stringify({ version: "2.3.4" }));
            const env = { GITHUB_ENV: envFile, RELEASE_BUILD: "true", REF_NAME: "v2.3.4" };
            const tagged = await runStep(platform, "version", directory, env);
            expect(tagged.status, tagged.stderr).toBe(0);
            expect(await readFile(envFile, "utf8")).toBe("VERSION=2.3.4\n");
            const unprefixed = await runStep(platform, "version", directory, { ...env, REF_NAME: "2.3.4" });
            expect(unprefixed.status, unprefixed.stderr).toBe(0);
            const mismatch = await runStep(platform, "version", directory, { ...env, REF_NAME: "v2.3.5" });
            expect(mismatch.status).not.toBe(0);
            expect(await readFile(envFile, "utf8")).toBe("VERSION=2.3.4\nVERSION=2.3.4\n");
            const branch = await runStep(platform, "version", directory, {
                ...env,
                RELEASE_BUILD: "false",
                REF_NAME: "main",
            });
            expect(branch.status, branch.stderr).toBe(0);
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });

    it.each(["android", "ios"])("packages %s native outputs and rejects missing builds", async (platform) => {
        const directory = await mkdtemp(path.join(tmpdir(), "writeme-mobile-staging-"));
        const source = path.join(
            directory,
            platform === "android"
                ? "packages/android/native/app/build/outputs/apk/debug/app-debug.apk"
                : "packages/ios/build/Writeme.xcarchive/Products/Applications/App.app/App",
        );
        try {
            const env = { VERSION: "2.3.4", GITHUB_WORKSPACE: directory, RUNNER_TEMP: path.join(directory, "temp") };
            const missing = await runStep(platform, "stage", directory, env);
            expect(missing.status).not.toBe(0);
            await mkdir(path.dirname(source), { recursive: true });
            await writeFile(source, "native-output");
            const result = await runStep(platform, "stage", directory, env);
            expect(result.status, result.stderr).toBe(0);
            const artifact = path.join(
                directory,
                "release-artifacts",
                platform === "android" ? "writeme-2.3.4-android-debug.apk" : "writeme-2.3.4-ios-unsigned.ipa",
            );
            if (platform === "android") {
                expect(await readFile(artifact, "utf8")).toBe("native-output");
            } else {
                const content = spawnSync("unzip", ["-p", artifact, "Payload/App.app/App"], { encoding: "utf8" });
                expect(content.status, content.stderr).toBe(0);
                expect(content.stdout).toBe("native-output");
            }
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });
});
