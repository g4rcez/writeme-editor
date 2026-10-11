import { spawnSync } from "node:child_process";
// @vitest-environment node
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
const script = path.resolve("packages/editor/src/lib/meeting-installers/install-whisper.sh");
const revision = "d1be6fde11ac6e0407606b4e42fe72d34add8037";

function fixture(manager = "apt-get"): {
    root: string;
    run: (extra?: Record<string, string>) => ReturnType<typeof spawnSync>;
} {
    const root = mkdtempSync(path.join(tmpdir(), "writeme-installer-"));
    roots.push(root);
    const stub = path.join(root, "stub");
    writeFileSync(
        stub,
        `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const command = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const root = process.env.INSTALLER_TEST_ROOT;
fs.appendFileSync(path.join(root, 'calls'), command + ' ' + args.join(' ') + '\\n');
if (command === 'uname') console.log('Linux');
if (command === 'id') console.log('1000');
if (command === 'sudo') {
    if (!fs.existsSync(path.join(root, 'cmake'))) fs.symlinkSync(path.join(root, 'stub'), path.join(root, 'cmake'));
}
if (command === 'curl') {
    if (process.env.FAIL_DOWNLOAD) process.exit(22);
    fs.writeFileSync(args[args.indexOf('-o') + 1], process.env.BAD_MODEL ? 'invalid' : 'valid');
}
if (command === 'tar') {
    const source = path.join(process.env.WRITEME_WHISPER_DIR, 'whisper.cpp-${revision}');
    fs.mkdirSync(path.join(source, 'models'), { recursive: true });
    fs.mkdirSync(path.join(source, 'build/bin'), { recursive: true });
    fs.symlinkSync(path.join(root, 'stub'), path.join(source, 'build/bin/whisper-server'));
}
if (command === 'cmake' && process.env.FAIL_BUILD) process.exit(1);
if (command === 'sha256sum') {
    const line = fs.readFileSync(0, 'utf8').trim();
    const file = line.slice(line.indexOf('  ') + 2);
    process.exit(fs.readFileSync(file, 'utf8') === 'valid' ? 0 : 1);
}
`,
    );
    chmodSync(stub, 0o755);
    for (const name of ["uname", "id", "sudo", manager, "ffmpeg", "curl", "make", "c++", "tar", "sha256sum"]) {
        symlinkSync(stub, path.join(root, name));
    }
    for (const name of ["bash", "mkdir", "touch", "mv", "chmod"]) {
        const executable = ["/bin", "/usr/bin"].map((directory) => path.join(directory, name)).find(existsSync);
        if (!executable) throw new Error(`Missing test tool: ${name}`);
        symlinkSync(executable, path.join(root, name));
    }
    writeFileSync(path.join(root, "calls"), "");
    return {
        root,
        run: (extra = {}) =>
            spawnSync("/bin/bash", [script], {
                encoding: "utf8",
                timeout: 10_000,
                env: {
                    ...process.env,
                    PATH: root,
                    WRITEME_WHISPER_DIR: path.join(root, "data with spaces"),
                    INSTALLER_TEST_ROOT: root,
                    ...extra,
                },
            }),
    };
}

afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it.skipIf(process.platform !== "win32")("parses the Windows installer with PowerShell", () => {
    const windowsScript = path
        .resolve("packages/editor/src/lib/meeting-installers/install-whisper.ps1")
        .replaceAll("'", "''");
    const result = spawnSync(
        "powershell.exe",
        [
            "-NoProfile",
            "-Command",
            `$tokens = $null; $errors = $null; [System.Management.Automation.Language.Parser]::ParseFile('${windowsScript}', [ref]$tokens, [ref]$errors) | Out-Null; if ($errors.Count) { $errors | Out-String | Write-Error; exit 1 }`,
        ],
        { encoding: "utf8" },
    );
    expect(result.status, String(result.stderr)).toBe(0);
});

describe.skipIf(process.platform === "win32")("Linux installer with external tools stubbed", () => {
    it.each(["apt-get", "dnf", "pacman"])(
        "installs with %s, starts the server and reuses verified downloads",
        (manager) => {
            const { root, run } = fixture(manager);
            const first = run();
            expect(first.status, String(first.stderr)).toBe(0);
            const calls = readFileSync(path.join(root, "calls"), "utf8");
            expect(calls).toContain(`sudo ${manager}`);
            expect(calls).toContain("--target whisper-server");
            expect(calls).toContain(
                "whisper-server --model models/ggml-base.bin --threads 4 --host 127.0.0.1 --port 8080 --convert --language auto",
            );
            expect(first.stdout).toContain("data with spaces/start-whisper.sh");
            writeFileSync(path.join(root, "calls"), "");
            const second = run();
            expect(second.status, String(second.stderr)).toBe(0);
            const repeated = readFileSync(path.join(root, "calls"), "utf8");
            expect(repeated).not.toContain("curl ");
            expect(repeated).not.toContain("sudo ");
            expect(repeated).toContain("whisper-server ");
        },
    );

    it.each([
        ["FAIL_DOWNLOAD", "Installation stopped"],
        ["FAIL_BUILD", "Installation stopped"],
        ["BAD_MODEL", "Model checksum verification failed"],
    ])("stops without launching after %s", (flag, message) => {
        const { root, run } = fixture();
        const result = run({ [flag]: "1" });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(message);
        expect(readFileSync(path.join(root, "calls"), "utf8")).not.toContain("whisper-server --model");
    });
});
