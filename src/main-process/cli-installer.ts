import { constants } from "node:fs";
import { access, chmod, lstat, mkdir, readlink, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type CliInstallResult = {
    installPath: string;
    sourcePath: string;
    mode: "cmd" | "symlink";
};

type InstallCliOptions = {
    appPath: string;
    platform?: NodeJS.Platform;
    env?: NodeJS.ProcessEnv;
    homeDir?: string;
    installPath?: string;
};

function cliExecutableName(platform: NodeJS.Platform): string {
    return platform === "win32" ? "writeme.exe" : "writeme";
}

export function resolveBundledCliPath(appPath: string, platform: NodeJS.Platform = process.platform): string {
    const relativeCliPath = path.join("packages", "cli", "dist", cliExecutableName(platform));
    const unpackedAppPath = appPath.replace(/([/\\])app\.asar([/\\]|$)/, `$1app.asar.unpacked$2`);
    return path.join(unpackedAppPath, relativeCliPath);
}

export function defaultCliInstallPath({
    platform = process.platform,
    env = process.env,
    homeDir = os.homedir(),
}: Pick<InstallCliOptions, "platform" | "env" | "homeDir"> = {}): string {
    if (platform === "win32") {
        return path.join(
            env.LOCALAPPDATA ?? path.join(homeDir, "AppData", "Local"),
            "Microsoft",
            "WindowsApps",
            "writeme.cmd",
        );
    }
    return path.join(homeDir, ".local", "bin", "writeme");
}

async function ensureExecutable(sourcePath: string, platform: NodeJS.Platform): Promise<void> {
    try {
        await access(sourcePath, constants.F_OK);
    } catch {
        throw new Error(`Bundled CLI not found at ${sourcePath}. Run npm run build:cli before packaging the app.`);
    }
    if (platform !== "win32") {
        await chmod(sourcePath, 0o755);
    }
}

async function removeExistingSymlink(targetPath: string): Promise<boolean> {
    try {
        const stat = await lstat(targetPath);
        if (!stat.isSymbolicLink()) return false;
        await readlink(targetPath);
        await unlink(targetPath);
        return true;
    } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            return true;
        }
        throw error;
    }
}

export async function installBundledCli(options: InstallCliOptions): Promise<CliInstallResult> {
    const platform = options.platform ?? process.platform;
    const sourcePath = resolveBundledCliPath(options.appPath, platform);
    const installPath =
        options.installPath ??
        defaultCliInstallPath({
            platform,
            env: options.env,
            homeDir: options.homeDir,
        });

    await ensureExecutable(sourcePath, platform);
    await mkdir(path.dirname(installPath), { recursive: true });

    if (platform === "win32") {
        await writeFile(installPath, `@echo off\r\n"${sourcePath}" %*\r\n`, "utf8");
        return { installPath, sourcePath, mode: "cmd" };
    }

    const canInstall = await removeExistingSymlink(installPath);
    if (!canInstall) {
        throw new Error(`Refusing to overwrite non-symlink file at ${installPath}. Remove it and try again.`);
    }
    await symlink(sourcePath, installPath);
    return { installPath, sourcePath, mode: "symlink" };
}
