const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
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

    base64 += B64_CHARS.charAt((triplet >> 18) & 0x3f) +
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
  // Remove padding for easier processing length calculation
  const str = base64.replace(/=+$/, "");
  const len = str.length;

  if (len % 4 === 1) {
    throw new Error("Invalid Base64 string");
  }

  // Every 4 base64 chars = 3 bytes
  // len includes the relevant chars.
  // We need to estimate byte length properly.
  // (len * 3) / 4 roughly, floor or ceil?
  // Let's iterate and build.
  
  const bufferLength = Math.floor((len * 3) / 4);
  const bytes = new Uint8Array(bufferLength);
  
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const encoded1 = B64_LOOKUP[str.charCodeAt(i)];
    const encoded2 = B64_LOOKUP[str.charCodeAt(i + 1)];
    const encoded3 = i + 2 < len ? B64_LOOKUP[str.charCodeAt(i + 2)] : 64; // 64 is sentinel, effectively 0 but handled by logic?
    // Actually simpler: just grab values. If undefined/NaN (past end), treat as 0
    // But since we stripped padding, we rely on `i < len`.

    const b1 = encoded1;
    const b2 = encoded2;
    const b3 = i + 2 < len ? B64_LOOKUP[str.charCodeAt(i + 2)] : 0;
    const b4 = i + 3 < len ? B64_LOOKUP[str.charCodeAt(i + 3)] : 0;

    const triplet = (b1 << 18) | (b2 << 12) | (b3 << 6) | b4;

    bytes[p++] = (triplet >> 16) & 0xFF;
    if (i + 2 < len) bytes[p++] = (triplet >> 8) & 0xFF;
    if (i + 3 < len) bytes[p++] = triplet & 0xFF;
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
  // Node.js optimization (Electron Main Process or Node.js environment)
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64');
  }

  // Browser / Pure JS Fallback
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
  // Node.js optimization (Electron Main Process or Node.js environment)
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64').toString('utf-8');
  }

  // Browser / Pure JS Fallback
  const bytes = decodeBase64ToBytes(str);
  return new TextDecoder().decode(bytes);
}