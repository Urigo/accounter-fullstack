import { describe, expect, it } from 'vitest';
import { base64ToBytes } from '../files.js';

describe('base64ToBytes', () => {
  it('decodes base64 to the exact bytes, high bytes included', () => {
    // Windows-1255 "שלום" followed by CRLF
    const bytes = base64ToBytes(btoa(String.fromCharCode(0xf9, 0xec, 0xe5, 0xed, 0x0d, 0x0a)));
    expect(Array.from(bytes)).toEqual([0xf9, 0xec, 0xe5, 0xed, 0x0d, 0x0a]);
  });

  it('decodes an empty string to no bytes', () => {
    expect(base64ToBytes('')).toHaveLength(0);
  });
});
