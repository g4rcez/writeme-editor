import { isElectron } from "./is-electron";
import { isSafeHttpUrl } from "./read-it-later-library";

export async function fetchReadItLaterUrl(url: string): Promise<string> {
    if (!isSafeHttpUrl(url)) throw new Error("Use a valid HTTP or HTTPS URL without embedded credentials.");

    if (isElectron()) {
        const result = await window.electronAPI.readItLater.fetchUrl(url);
        if (!result.success || typeof result.html !== "string") {
            throw new Error(result.error || "Could not fetch this URL.");
        }
        return result.html;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not fetch this URL (HTTP ${response.status}).`);
    return response.text();
}

const bundledLanguages = [
    "typescript",
    "javascript",
    "markdown",
    "haskell",
    "python",
    "kotlin",
    "csharp",
    "swift",
    "shell",
    "scala",
    "yaml",
    "rust",
    "ruby",
    "json",
    "java",
    "html",
    "bash",
    "yml",
    "xml",
    "sql",
    "php",
    "css",
    "cpp",
    "ts",
    "sh",
    "rs",
    "rb",
    "py",
    "md",
    "kt",
    "js",
    "hs",
    "go",
    "cs",
    "c",
];

const unwantedSelectors = [
    "script",
    "style",
    "noscript",
    "iframe",
    "header",
    "footer",
    "nav",
    "aside",
    "form",
    "svg",
    "canvas",
    ".ads",
    ".sidebar",
    "#sidebar",
    ".menu",
    "#menu",
];

export function parseReadItLaterHtml(
    html: string,
    url: string,
    hostOrigin: string,
): {
    title: string;
    html: string;
    description: string | null;
    favicon: string | null;
} {
    let origin: string;
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
            throw new Error("Only HTTP(S) URLs are supported.");
        }
        origin = parsedUrl.origin;
    } catch {
        throw new Error("Use a valid HTTP or HTTPS article URL.");
    }
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("a[href]").forEach((anchor) => {
        const a = anchor as HTMLAnchorElement;
        a.href = a.href.replace(hostOrigin, origin);
    });
    const title = doc.title || doc.querySelector("title")?.innerText || "Read It Later Note";
    let description = null;
    const metaDesc =
        doc.querySelector('meta[name="description"]') || doc.querySelector('meta[property="og:description"]');
    if (metaDesc) {
        description = metaDesc.getAttribute("content");
    }
    let favicon = null;
    const iconLink =
        doc.querySelector('link[rel="icon"]') ||
        doc.querySelector('link[rel="shortcut icon"]') ||
        doc.querySelector('link[rel="apple-touch-icon"]');

    if (iconLink) {
        const href = iconLink.getAttribute("href");
        if (href) {
            if (url && !href.startsWith("http")) {
                try {
                    favicon = new URL(href, url).href;
                } catch {
                    favicon = href;
                }
            } else {
                favicon = href;
            }
        }
    } else if (url) {
        try {
            favicon = new URL("/favicon.ico", url).href;
        } catch {
            favicon = null;
        }
    }

    unwantedSelectors.forEach((selector) => {
        doc.querySelectorAll(selector).forEach((el) => el.remove());
    });

    doc.querySelectorAll("pre").forEach((pre) => {
        if (!pre.querySelector("code")) {
            const code = doc.createElement("code");
            code.append(...Array.from(pre.childNodes));
            pre.replaceChildren(code);
        }
        const original = pre.querySelector("code");
        if (!original) return;
        const classes = [...pre.classList, ...original.classList];
        const langClass = classes.find((c) => {
            const lower = c.toLowerCase();
            return lower.startsWith("language-") || lower.startsWith("lang-") || bundledLanguages.includes(lower);
        });
        const children = Array.from(original.childNodes);
        original.replaceChildren();
        for (const child of children) {
            if (child.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes((child as Element).tagName)) {
                original.appendChild(doc.createTextNode((child.textContent ?? "") + "\n"));
            } else {
                original.appendChild(child);
            }
        }
        if (langClass) {
            const lang = langClass.toLowerCase().replace("language-", "").replace("lang-", "");
            original.className = `language-${lang}`;
            pre.removeAttribute("class");
        }
    });
    const mainContent = doc.querySelector("article") || doc.querySelector("main") || doc.body;
    return { title, favicon, description, html: mainContent.innerHTML };
}
