import type { GitCounts, ParsedStatus } from "@/types/git";

const emptyCounts = (): GitCounts => ({
    modified: 0,
    added: 0,
    deleted: 0,
    renamed: 0,
    untracked: 0,
    conflicted: 0,
});

const parseHeader = (line: string): { branch: string; upstream: string | null } => {
    const body = line.replace(/^## /, "").replace(/\s*\[[^\]]+\]\s*$/, "");
    if (body.startsWith("HEAD (no branch)")) return { branch: "HEAD", upstream: null };
    const sep = body.indexOf("...");
    if (sep === -1) return { branch: body.trim(), upstream: null };
    return {
        branch: body.slice(0, sep).trim(),
        upstream: body.slice(sep + 3).trim() || null,
    };
};

export const parsePorcelain = (stdout: string): ParsedStatus => {
    const lines = stdout.split("\n");
    const counts = emptyCounts();
    let branch = "HEAD";
    let upstream: string | null = null;

    for (const raw of lines) {
        if (raw === "") continue;
        if (raw.startsWith("## ")) {
            ({ branch, upstream } = parseHeader(raw));
            continue;
        }
        const xy = raw.slice(0, 2);
        if (xy === "??") {
            counts.untracked += 1;
            continue;
        }
        if (xy.includes("U") || xy === "AA" || xy === "DD") {
            counts.conflicted += 1;
            continue;
        }
        const x = xy[0];
        const y = xy[1];
        if (x === "R" || y === "R") {
            counts.renamed += 1;
            continue;
        }
        if (x === "A") {
            counts.added += 1;
            continue;
        }
        if (x === "D" || y === "D") {
            counts.deleted += 1;
            continue;
        }
        if (x === "M" || y === "M") {
            counts.modified += 1;
            continue;
        }
    }

    const hasChanges =
        counts.modified + counts.added + counts.deleted + counts.renamed + counts.untracked + counts.conflicted > 0;

    return { branch, upstream, counts, hasChanges };
};
