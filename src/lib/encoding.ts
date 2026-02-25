const B64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_LOOKUP = new Uint8Array(256);
for (let i = 0; i < B64_CHARS.length; i++) {
  B64_LOOKUP[B64_CHARS.charCodeAt(i)] = i;
}

/**
 * Pure JavaScript implementation of Base64 encoding for byte arrays.
 * Replaces btoa usage.
 */
function encodeBytesToBase64(bytes: Uint8Array): string {
  const len = bytes.length;
  let base64 = "";
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;
    const triplet = (b1 << 16) | (b2 << 8) | b3;
    base64 +=
      B64_CHARS.charAt((triplet >> 18) & 0x3f) +
      B64_CHARS.charAt((triplet >> 12) & 0x3f) +
      (i + 1 < len ? B64_CHARS.charAt((triplet >> 6) & 0x3f) : "=") +
      (i + 2 < len ? B64_CHARS.charAt(triplet & 0x3f) : "=");
  }
  return base64;
}

/**
 * Pure JavaScript implementation of Base64 decoding to byte arrays.
 * Replaces atob usage.
 */
function decodeBase64ToBytes(base64: string): Uint8Array {
  const str = base64.replace(/=+$/, "");
  const len = str.length;
  if (len % 4 === 1) {
    throw new Error("Invalid Base64 string");
  }
  const bufferLength = Math.floor((len * 3) / 4);
  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const encoded1 = B64_LOOKUP[str.charCodeAt(i)];
    const encoded2 = B64_LOOKUP[str.charCodeAt(i + 1)];
    const encoded3 = i + 2 < len ? B64_LOOKUP[str.charCodeAt(i + 2)] : 64; // 64 is sentinel, effectively 0 but handled by logic?
    const b1 = encoded1;
    const b2 = encoded2;
    const b3 = i + 2 < len ? B64_LOOKUP[str.charCodeAt(i + 2)] : 0;
    const b4 = i + 3 < len ? B64_LOOKUP[str.charCodeAt(i + 3)] : 0;
    const triplet = (b1 << 18) | (b2 << 12) | (b3 << 6) | b4;
    bytes[p++] = (triplet >> 16) & 0xff;
    if (i + 2 < len) bytes[p++] = (triplet >> 8) & 0xff;
    if (i + 3 < len) bytes[p++] = triplet & 0xff;
  }
  return bytes;
}

/**
 * Encodes a UTF-8 string to Base64.
 * Compatible with both Browser and Node.js (Electron) environments.
 *
 * @param str The UTF-8 string to encode
 * @returns The Base64 encoded string
 */
export function utf8ToBase64(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8").toString("base64");
  }
  const bytes = new TextEncoder().encode(str);
  return encodeBytesToBase64(bytes);
}

/**
 * Decodes a Base64 string to UTF-8.
 * Compatible with both Browser and Node.js (Electron) environments.
 *
 * @param str The Base64 string to decode
 * @returns The decoded UTF-8 string
 */
export function base64ToUtf8(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "base64").toString("utf-8");
  }
  const bytes = decodeBase64ToBytes(str);
  return new TextDecoder().decode(bytes);
}

export const SAFE_MARKDOWN = /^[\u200B\u200C\u200D\u200E\u200F\uFEFF]/;

export const safeMarkdown = (s: string = "") => s.replace(SAFE_MARKDOWN, "");

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

export const innerUrl = (path: string) => join("https://writeme.dev", path);
