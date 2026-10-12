export const platforms = ["windows", "ios", "osx", "linux", "android"] as const;
export const suites = ["browser", "production", "native", "landing", "profiles", "mobile", "device"] as const;
export type Platform = (typeof platforms)[number];
export type Suite = (typeof suites)[number];

export function parseE2EArguments(args: string[]): {
    platform: Platform;
    suite: Suite;
    forwarded: string[];
    projects: string[];
} {
    let platform: Platform | undefined;
    let suite: Suite | undefined;
    const forwarded: string[] = [];
    const projects: string[] = [];
    for (let index = 0; index < args.length; index++) {
        const arg = args[index]!;
        const option = arg.split("=", 1)[0];
        if (option === "--config" || option === "-c")
            throw new Error("Use --platform and --suite instead of --config.");
        if (option === "--platform" || option === "--suite" || option === "--project") {
            const value = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : args[++index];
            if (!value || value.startsWith("-")) throw new Error(`${option} requires a value.`);
            if (option === "--platform") {
                if (platform || !platforms.includes(value as Platform))
                    throw new Error(`Choose one platform: ${platforms.join(", ")}`);
                platform = value as Platform;
            } else if (option === "--suite") {
                if (suite || !suites.includes(value as Suite))
                    throw new Error(`Choose one suite: ${suites.join(", ")}`);
                suite = value as Suite;
            } else {
                projects.push(value);
                forwarded.push("--project", value);
                while (args[index + 1] && !args[index + 1]!.startsWith("-")) {
                    const project = args[++index]!;
                    projects.push(project);
                    forwarded.push(project);
                }
            }
        } else {
            forwarded.push(arg);
        }
    }
    if (!platform || !suite)
        throw new Error(
            "Usage: npm run test:e2e -- --platform <windows|ios|osx|linux|android> --suite <browser|production|native|landing|profiles|mobile|device> [Playwright options]",
        );
    const mobile = platform === "ios" || platform === "android";
    if (suite === "native" && mobile)
        throw new Error("Native is the desktop Electron suite, not mobile browser emulation.");
    if (suite === "mobile" && !mobile) throw new Error("The mobile suite requires ios or android.");
    if (suite === "device" && platform !== "android")
        throw new Error("The automated physical-device suite requires Android; iPad/Pencil checks are operator-run.");
    if (suite === "profiles" && (platform === "windows" || platform === "linux"))
        throw new Error("Existing restricted build profiles are osx, ios and android only.");
    return { platform, suite, forwarded, projects };
}

export function matchesProject(name: string, patterns: readonly string[]): boolean {
    return (
        patterns.length === 0 ||
        patterns.some((pattern) => {
            const escaped = pattern
                .split("*")
                .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                .join(".*");
            return new RegExp(`^${escaped}$`, "i").test(name);
        })
    );
}
