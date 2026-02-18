export type DomainIdentification = {
  domain: string;
  id: string;
  url: string;
};

/**
 * Identifies the service and unique ID from a given URL.
 * Currently supports YouTube.
 *
 * @param url The URL to identify
 * @returns DomainIdentification object or null if not identified
 */
export function identifyDomain(url: string): DomainIdentification | null {
  try {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return null;

    const parsed = new URL(trimmedUrl);
    const host = parsed.hostname.replace(/^www\./, "");
    const youtubeHosts = [
      "youtube.com",
      "m.youtube.com",
      "youtu.be",
      "youtube.com.br",
      "www.youtube.com.br",
    ];

    if (
      youtubeHosts.includes(host) ||
      parsed.hostname.endsWith(".youtube.com")
    ) {
      let id: string | null = null;
      const pathname = parsed.pathname;

      if (host === "youtu.be") {
        id = pathname.slice(1);
      } else if (pathname.startsWith("/live/")) {
        id = pathname.split("/")[2];
      } else if (pathname.startsWith("/embed/")) {
        id = pathname.split("/")[2];
      } else if (pathname.startsWith("/v/")) {
        id = pathname.split("/")[2];
      } else if (pathname.startsWith("/shorts/")) {
        id = pathname.split("/")[2];
      } else if (pathname === "/watch") {
        id = parsed.searchParams.get("v");
      } else if (parsed.searchParams.has("v")) {
        id = parsed.searchParams.get("v");
      }

      // Check for any extra path segments or query params in ID (sometimes happens with splitting)
      if (id) {
        id = id.split(/[?&#]/)[0];
      }

      if (id && id.length >= 10) {
        return {
          domain: "youtube",
          id,
          url: trimmedUrl,
        };
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}
