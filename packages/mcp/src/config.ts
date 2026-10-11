import { homedir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import type { ReaderOptions } from "./contracts.js";

export const HELP = `Writeme MCP — read-only access to saved workspace data

Usage: writeme-mcp [options]

  --profile production|development  Desktop profile (default: production)
  --data-dir PATH                   Directory containing writeme.sqlite
  --workspace PATH                  Workspace root (default: saved directory)
  --help                            Show this help
  --version                         Show package version

Transport: stdio. Node.js >=22.13, Bun >=1.3, or Deno >=2.2 (>=2.4.5 on Windows).
No editor connection is needed. Deno requires read, write, env and sys permissions.
Only saved data is exposed; no settings, notes, or editor state are changed.
`;

export function assertSupportedRuntime(
    platform: NodeJS.Platform = process.platform,
    denoVersion: string | undefined = Reflect.get(globalThis, "Deno")?.version?.deno,
): void {
    if (platform !== "win32" || !denoVersion) return;
    const [major = 0, minor = 0, patch = 0] = denoVersion.split(".").map(Number);
    if (major > 2 || (major === 2 && (minor > 4 || (minor === 4 && patch >= 5)))) return;
    throw new Error("Deno 2.4.5 or newer is required on Windows to release SQLite snapshot files.");
}

export function defaultDataDir(
    profile: ReaderOptions["profile"],
    platform: NodeJS.Platform = process.platform,
    env: NodeJS.ProcessEnv = process.env,
    home: string = homedir(),
): string {
    const appName = profile === "development" ? "writeme-dev" : "writeme";
    const base =
        platform === "darwin"
            ? path.join(home, "Library", "Application Support")
            : platform === "win32"
              ? env.APPDATA || path.join(home, "AppData", "Roaming")
              : env.XDG_CONFIG_HOME || path.join(home, ".config");
    return path.join(base, appName);
}

export function parseOptions(args: string[]): { help: boolean; version: boolean; reader: ReaderOptions } {
    const { values } = parseArgs({
        args,
        options: {
            profile: { type: "string", default: "production" },
            "data-dir": { type: "string" },
            workspace: { type: "string" },
            help: { type: "boolean", short: "h", default: false },
            version: { type: "boolean", default: false },
        },
        strict: true,
        allowPositionals: false,
    });
    if (values.profile !== "production" && values.profile !== "development") {
        throw new Error("--profile must be production or development.");
    }
    for (const key of ["data-dir", "workspace"] as const) {
        if (values[key] !== undefined && !values[key]?.trim()) throw new Error(`--${key} must not be empty.`);
    }
    return {
        help: values.help,
        version: values.version,
        reader: {
            profile: values.profile,
            dataDir: path.resolve(values["data-dir"] ?? defaultDataDir(values.profile)),
            ...(values.workspace === undefined ? {} : { workspace: path.resolve(values.workspace) }),
        },
    };
}
