const results: Record<string, { result?: string }> = JSON.parse(process.env.PR_CHECK_RESULTS ?? "{}");
const checks = Object.entries(results);

if (checks.length === 0) {
    throw new Error("No pull request checks were reported.");
}

const blockers = checks.filter(([, check]) => check?.result !== "success");
if (blockers.length > 0) {
    throw new Error(
        `Pull request checks must all succeed: ${blockers.map(([name, check]) => `${name}=${check?.result ?? "missing"}`).join(", ")}`,
    );
}

console.log(`All ${checks.length} pull request checks passed.`);
