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
  content: string;
  description: string | null;
  favicon: string | null;
} {
  const origin = new URL(url).origin;
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("a[href]").forEach((anchor: HTMLAnchorElement) => {
    anchor.href = anchor.href.replace(hostOrigin, origin);
  });
  const title = doc.title || "Read It Later Note";
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
    } catch (e) {}
  }
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
  unwantedSelectors.forEach((selector) => {
    doc.querySelectorAll(selector).forEach((el) => el.remove());
  });
  const mainContent =
    doc.querySelector("article") || doc.querySelector("main") || doc.body;
  return { title, favicon, description, content: mainContent.innerHTML };
}
