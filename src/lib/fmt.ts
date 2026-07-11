export function fishify(path: string, home = ""): string {
    if (!path) return "";

    const normalized = normalizeSlashes(path);
    const normalizedHome = home ? normalizeSlashes(home).replace(/\/$/, "") : "";

    const withHome =
        normalizedHome && (normalized === normalizedHome || normalized.startsWith(`${normalizedHome}/`))
            ? `~${normalized.slice(normalizedHome.length)}`
            : normalized;

    const isAbsolute = withHome.startsWith("/");
    const isHome = withHome.startsWith("~/");

    const prefix = isHome ? "~/" : isAbsolute ? "/" : "";
    const withoutPrefix = isHome ? withHome.slice(2) : isAbsolute ? withHome.slice(1) : withHome;

    const parts = withoutPrefix.split("/").filter(Boolean);

    if (parts.length <= 1) {
        return `${prefix}${parts.join("/")}`;
    }

    const dirs = parts.slice(0, -1).map(abbreviateDir);
    const last = parts.at(-1)!;

    return `${prefix}${[...dirs, last].join("/")}`;
}

function normalizeSlashes(path: string): string {
    let result = "";
    let previousWasSlash = false;

    for (const char of path) {
        if (char === "/") {
            if (!previousWasSlash) result += char;
            previousWasSlash = true;
        } else {
            result += char;
            previousWasSlash = false;
        }
    }

    return result;
}

function abbreviateDir(dir: string): string {
    if (dir === "." || dir === "..") return dir;

    // Fish-like behavior for hidden dirs:
    // ".config" -> ".c"
    if (dir.startsWith(".") && dir.length > 1) {
        return `.${dir[1]}`;
    }

    return dir[0] ?? "";
}
