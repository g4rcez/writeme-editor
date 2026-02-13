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

const mustBeParsed = bundledLanguages.filter((x) => x.length >= 3);

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

const regex = { init: /^\/+/, end: /\/+$/ };

const trailingPath = (str: string) =>
  str === "/" ? str : str.replace(regex.init, "/").replace(regex.end, "");

const join = (baseURL: string, ...urls: string[]) =>
  trailingPath(
    urls.reduce(
      (acc, el) =>
        acc.replace(regex.end, "") + "/" + el.replace(regex.init, ""),
      baseURL,
    ),
  );

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
  const origin = new URL(url).origin;
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("a[href]").forEach((anchor: HTMLAnchorElement) => {
    anchor.href = anchor.href.replace(hostOrigin, origin);
  });
  const title =
    doc.title || doc.querySelector("title")?.innerText || "Read It Later Note";
  let description = null;
  const metaDesc =
    doc.querySelector('meta[name="description"]') ||
    doc.querySelector('meta[property="og:description"]');
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
        } catch (e) {
          favicon = href;
        }
      } else {
        favicon = href;
      }
    }
  } else if (url) {
    try {
      favicon = new URL("/favicon.ico", url).href;
    } catch (e) { }
  }

  unwantedSelectors.forEach((selector) => {
    doc.querySelectorAll(selector).forEach((el) => el.remove());
  });

  doc.querySelectorAll("pre").forEach((pre) => {
    if (!pre.querySelector("code")) {
      const code = doc.createElement("code");
      code.innerHTML = pre.innerHTML;
      pre.innerHTML = "";
      pre.appendChild(code);
    }
    const original = pre.querySelector("code")!;
    const code = doc.createElement("code");
    const length = original.childElementCount;
    original.childNodes.forEach((c, i) => {
      code.appendChild(c);
      if (length - 1 === i) return;
      code.appendChild(doc.createElement("br"));
    });
    const classes = [...pre.classList, ...original.classList];
    const langClass = classes.find((c) => {
      const lower = c.toLowerCase();
      return (
        lower.startsWith("language-") ||
        lower.startsWith("lang-") ||
        bundledLanguages.includes(lower)
      );
    });
    if (langClass) {
      const lang = langClass
        .toLowerCase()
        .replace("language-", "")
        .replace("lang-", "");
      code.classList.remove(...code.classList);
      code.classList.add(`language-${lang}`);
      pre.removeAttribute("class");
    }
    original.innerHTML = code.innerHTML;
  });
  const mainContent =
    doc.querySelector("article") || doc.querySelector("main") || doc.body;
  return { title, favicon, description, html: mainContent.innerHTML };
}
