import { describe, it, expect } from 'vitest';
import { utf8ToBase64, base64ToUtf8 } from './encoding';

describe('encoding utils', () => {
  it('should encode and decode simple ASCII strings', () => {
    const original = 'Hello World';
    const encoded = utf8ToBase64(original);
    expect(encoded).toBe('SGVsbG8gV29ybGQ=');
    expect(base64ToUtf8(encoded)).toBe(original);
  });

  it('should encode and decode UTF-8 strings with emojis', () => {
    const original = 'Hello 🌍';
    // "Hello 🌍" in UTF-8 base64 is SGVsbG8g8J+MjQ==
    const encoded = utf8ToBase64(original);
    expect(encoded).toBe('SGVsbG8g8J+MjQ==');
    expect(base64ToUtf8(encoded)).toBe(original);
  });

  it('should encode and decode UTF-8 strings with special characters', () => {
    const original = 'são é\'"; ça va? µ §';
    const encoded = utf8ToBase64(original);
    expect(base64ToUtf8(encoded)).toBe(original);
  });

  it('should handle empty strings', () => {
    expect(utf8ToBase64('')).toBe('');
    expect(base64ToUtf8('')).toBe('');
  });
});
