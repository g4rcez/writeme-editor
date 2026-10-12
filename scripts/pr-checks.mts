const requiredChecks = ["platforms", "mcp"];
const results: unknown = JSON.parse(process.env.PR_CHECK_RESULTS ?? "{}");

if (!results || typeof results !== "object" || Array.isArray(results)) {
    throw new Error("Pull request check results must be an object.");
}

const checks = Object.entries(results);
const reported = new Set(checks.map(([name]) => name));
const blockers = requiredChecks.filter((name) => !reported.has(name)).map((name) => `${name}=missing`);

for (const [name, check] of checks) {
    const result = check && typeof check === "object" && "result" in check ? check.result : undefined;
    if (result !== "success") blockers.push(`${name}=${typeof result === "string" ? result : "missing"}`);
}

if (blockers.length > 0) {
    throw new Error(`Pull request checks must all succeed: ${blockers.join(", ")}`);
}

console.log(`All ${checks.length} pull request checks passed.`);
