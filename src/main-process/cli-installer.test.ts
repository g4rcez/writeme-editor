import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultCliInstallPath,
  installBundledCli,
  resolveBundledCliPath,
} from "./cli-installer";

describe("cli-installer", () => {
  it("resolves the unpacked CLI path when the app is inside app.asar", () => {
    expect(resolveBundledCliPath("/App/Contents/Resources/app.asar")).toBe(
      "/App/Contents/Resources/app.asar.unpacked/packages/cli/dist/writeme",
    );
  });

  it("uses a per-user install path on POSIX", () => {
    expect(
      defaultCliInstallPath({ platform: "darwin", homeDir: "/Users/me" }),
    ).toBe("/Users/me/.local/bin/writeme");
  });

  it("creates a symlink to the bundled CLI", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "writeme-cli-install-"));
    const appPath = path.join(dir, "app");
    const sourcePath = path.join(appPath, "packages", "cli", "dist", "writeme");
    const installPath = path.join(dir, "bin", "writeme");
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, "#!/bin/sh\n", "utf8");

    const result = await installBundledCli({
      appPath,
      platform: "darwin",
      installPath,
    });

    expect(result).toStrictEqual({
      installPath,
      sourcePath,
      mode: "symlink",
    });
  });

  it("refuses to overwrite a non-symlink POSIX target", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "writeme-cli-install-"));
    const appPath = path.join(dir, "app");
    const sourcePath = path.join(appPath, "packages", "cli", "dist", "writeme");
    const installPath = path.join(dir, "bin", "writeme");
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await mkdir(path.dirname(installPath), { recursive: true });
    await writeFile(sourcePath, "#!/bin/sh\n", "utf8");
    await writeFile(installPath, "existing", "utf8");

    await expect(
      installBundledCli({ appPath, platform: "linux", installPath }),
    ).rejects.toThrow(/Refusing to overwrite/);
  });

  it("writes a Windows command shim", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "writeme-cli-install-"));
    const appPath = path.join(dir, "app");
    const sourcePath = path.join(
      appPath,
      "packages",
      "cli",
      "dist",
      "writeme.exe",
    );
    const installPath = path.join(dir, "writeme.cmd");
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, "exe", "utf8");

    await installBundledCli({ appPath, platform: "win32", installPath });

    await expect(readFile(installPath, "utf8")).resolves.toContain(
      `"${sourcePath}" %*`,
    );
  });

  it("replaces an existing symlink", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "writeme-cli-install-"));
    const appPath = path.join(dir, "app");
    const sourcePath = path.join(appPath, "packages", "cli", "dist", "writeme");
    const oldTarget = path.join(dir, "old-writeme");
    const installPath = path.join(dir, "bin", "writeme");
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await mkdir(path.dirname(installPath), { recursive: true });
    await writeFile(sourcePath, "#!/bin/sh\n", "utf8");
    await writeFile(oldTarget, "#!/bin/sh\n", "utf8");
    await symlink(oldTarget, installPath);

    await expect(
      installBundledCli({ appPath, platform: "darwin", installPath }),
    ).resolves.toMatchObject({ installPath, sourcePath });
  });
});
