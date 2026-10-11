import type { Plugin } from "vite";
import { parse } from "@babel/parser";
import fs from "node:fs/promises";
import path from "node:path";
import type { BuildProfile, FeatureName } from "./profiles.mts";

const restrictedPaths: Partial<Record<FeatureName, string[]>> = {
    ai: [
        "app/ai/",
        "app/writing-assistant/writing-assistant.tsx",
        "app/pages/chat.page.tsx",
        "app/pages/oauth-callback.page.tsx",
        "app/pages/settings/settings-ai.page.tsx",
        "app/components/settings/ai-settings.tsx",
        "app/components/sidebar/chat-sidebar-content.tsx",
        "ipc/ai-",
        "main-process/ai-runner.ts",
    ],
    terminal: ["ipc/terminal.ipc.ts", "lib/terminal/", "app/components/terminal/", "app/pages/terminal.page.tsx"],
    codeExecution: [
        "ipc/execution.ipc.ts",
        "lib/execution-config.ts",
        "lib/run-javascript.ts",
        "app/pages/examples/eval.page.tsx",
        "app/pages/examples/code-run.page.tsx",
    ],
    templateScripts: ["lib/run-template-script.ts", "app/components/settings/custom-variables.tsx"],
    git: ["ipc/git.ipc.ts", "main-process/git-runner.ts", "app/components/git-"],
    cli: ["main-process/cli-installer.ts", "main-process/cli-server.ts"],
    meetingNotes: [
        "main-process/meeting-capture.ts",
        "lib/meeting-audio.ts",
        "lib/meeting-installer.ts",
        "lib/meeting-installers/",
        "app/components/meeting-note-panel.tsx",
        "app/components/meeting-setup-wizard.tsx",
    ],
    localProxy: ["server/proxy.ts", "lib/proxy-fetch.ts"],
    autoUpdate: ["main-process/app-updater.ts"],
    multiInstance: ["main-process/workspace-instance.ts"],
};

export function restrictedFeature(id: string, profile: BuildProfile): FeatureName | undefined {
    const relative = id.replaceAll("\\", "/").split("/packages/editor/src/")[1]?.split("?")[0];
    if (!relative || relative.endsWith("/types.ts") || relative === "app/ai/events.ts") return undefined;
    return (Object.entries(restrictedPaths) as [FeatureName, string[]][]).find(
        ([feature, paths]) => !profile.features[feature] && paths.some((prefix) => relative.startsWith(prefix)),
    )?.[0];
}

function disabledModule(source: string, id: string, feature: FeatureName): string {
    if (id.endsWith("/execution-config.ts")) return "export const EXECUTION_CONFIG = {};";
    const file = parse(source, { sourceType: "module", plugins: ["typescript", "jsx"] });
    const exports = new Set<string>();
    let defaultExport = false;
    for (const statement of file.program.body) {
        if (statement.type === "ExportDefaultDeclaration") {
            defaultExport = true;
            continue;
        }
        if (statement.type === "ExportAllDeclaration") throw new Error(`Unsupported disabled re-export in ${id}`);
        if (statement.type !== "ExportNamedDeclaration" || statement.exportKind === "type") continue;
        const declaration = statement.declaration;
        if (declaration?.type === "FunctionDeclaration" || declaration?.type === "ClassDeclaration") {
            if (declaration.id) exports.add(declaration.id.name);
        } else if (declaration?.type === "TSEnumDeclaration") {
            exports.add(declaration.id.name);
        } else if (declaration?.type === "VariableDeclaration") {
            for (const variable of declaration.declarations) {
                if (variable.id.type !== "Identifier") throw new Error(`Unsupported disabled export in ${id}`);
                exports.add(variable.id.name);
            }
        }
        for (const specifier of statement.specifiers) {
            if (specifier.type === "ExportSpecifier" && specifier.exportKind === "type") continue;
            if (specifier.exported.type !== "Identifier") throw new Error(`Unsupported disabled export in ${id}`);
            exports.add(specifier.exported.name);
        }
    }
    const implementation = id.endsWith(".tsx")
        ? "function unavailable() { return null; }"
        : `function deny() { throw new Error(${JSON.stringify(`Feature ${feature} is unavailable in this build.`)}); }
const unavailable = new Proxy(deny, { get: () => deny, apply: deny, construct: deny });`;
    return [
        implementation,
        ...[...exports].map((name) => `export const ${name} = unavailable;`),
        ...(defaultExport ? ["export default unavailable;"] : []),
    ].join("\n");
}

export function buildFeaturePlugin(profile: BuildProfile, surface: "main" | "preload" | "renderer"): Plugin {
    const excluded = new Set<string>();
    return {
        name: "writeme-build-features",
        enforce: "pre",
        config: () => ({
            define: { __WRITEME_BUILD__: JSON.stringify(profile) },
            ...(profile.channel === "app-store" || profile.channel === "google-play"
                ? { build: { sourcemap: false } }
                : {}),
        }),
        async load(id) {
            const feature = restrictedFeature(id, profile);
            if (!feature) return null;
            excluded.add(path.relative(process.cwd(), id).replaceAll("\\", "/"));
            const filePath = id.split("?")[0]!;
            if (!/\.tsx?$/.test(filePath))
                throw new Error(`Executable resources for disabled feature ${feature} cannot be bundled: ${filePath}`);
            return disabledModule(await fs.readFile(filePath, "utf8"), filePath, feature);
        },
        generateBundle(_options, bundle) {
            const shellFeatures = ["terminal", "codeExecution", "git", "cli", "multiInstance"] as const;
            if (
                shellFeatures.every((feature) => !profile.features[feature]) &&
                Object.values(bundle).some(
                    (output) =>
                        output.type === "chunk" &&
                        [...output.imports, ...output.dynamicImports].some(
                            (id) => id === "node:child_process" || id === "child_process",
                        ),
                )
            ) {
                this.error("OS subprocess execution reached a build without shell capabilities.");
            }
            if (
                !profile.features.terminal &&
                Object.values(bundle).some(
                    (output) =>
                        output.type === "chunk" &&
                        [...output.imports, ...output.dynamicImports, ...Object.keys(output.modules)].some(
                            (id) => id === "node-pty" || id.includes("/node-pty/"),
                        ),
                )
            ) {
                this.error("Disabled terminal native dependency reached the bundle.");
            }
            this.emitFile({
                type: "asset",
                fileName: `writeme-build-${surface}.json`,
                source: JSON.stringify({ version: 1, ...profile, excludedModules: [...excluded].sort() }, null, 2),
            });
        },
    };
}
