import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const usage = "Usage: node scripts/release-version.mjs <classify <commit-title> | next <version> <major|minor|patch>>";

export function classifyReleaseBump(title) {
    const subject = title.trim().split(/\r?\n/, 1)[0] ?? "";
    const conventional = /^(feat|fix)(?:\([^)]*\))?(!)?(?::|\s|$)/i.exec(subject);

    if (conventional?.[2] === "!") return "major";
    if (conventional?.[1]?.toLowerCase() === "feat") return "minor";
    if (conventional?.[1]?.toLowerCase() === "fix") return "patch";
    if (/^add(?:\([^)]*\))?(?::|\s|$)/i.test(subject)) return "minor";

    return "patch";
}

export function nextReleaseVersion(version, bump) {
    const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
    if (!match) throw new Error(`Invalid stable semantic version: ${version}`);
    if (!["major", "minor", "patch"].includes(bump)) throw new Error(`Invalid release bump: ${bump}`);

    let major = Number(match[1]);
    let minor = Number(match[2]);
    let patch = Number(match[3]);
    if (![major, minor, patch].every(Number.isSafeInteger)) throw new Error(`Version is too large: ${version}`);

    if (bump === "major") {
        major += 1;
        minor = 0;
        patch = 0;
    } else if (bump === "minor") {
        minor += 1;
        patch = 0;
    } else {
        patch += 1;
    }
    if (![major, minor, patch].every(Number.isSafeInteger)) {
        throw new Error(`Next version exceeds the safe integer range: ${version}`);
    }

    return `${major}.${minor}.${patch}`;
}

function main(args) {
    const [command, ...values] = args;
    if (command === "classify" && values.length === 1) {
        console.log(classifyReleaseBump(values[0]));
        return;
    }
    if (command === "next" && values.length === 2) {
        console.log(nextReleaseVersion(values[0], values[1]));
        return;
    }
    throw new Error(usage);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        main(process.argv.slice(2));
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
