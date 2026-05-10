import { describe, expect, it } from 'vitest';
import { decryptCredential, encryptCredential } from '../encryption.js';

const TEST_KEY = 'a'.repeat(64);
const PLAINTEXT = '{"id":"test-id","secret":"test-secret"}';

describe('encryptCredential / decryptCredential', () => {
  it('round-trips a string correctly', () => {
    const blob = encryptCredential(PLAINTEXT, TEST_KEY);
    expect(decryptCredential(blob, TEST_KEY)).toBe(PLAINTEXT);
  });

  it('produces a different blob each call (non-deterministic IV)', () => {
    const blob1 = encryptCredential(PLAINTEXT, TEST_KEY);
    const blob2 = encryptCredential(PLAINTEXT, TEST_KEY);
    expect(blob1).not.toBe(blob2);
  });

  it('throws when the ciphertext section is tampered', () => {
    const blob = encryptCredential(PLAINTEXT, TEST_KEY);
    const buf = Buffer.from(blob, 'base64');
    // iv=12 bytes, authTag=16 bytes → ciphertext starts at byte 28
    buf[28] = buf[28] ^ 0xff;
    const tampered = buf.toString('base64');
    expect(() => decryptCredential(tampered, TEST_KEY)).toThrow();
  });

  it('throws when decrypted with a wrong key', () => {
    const blob = encryptCredential(PLAINTEXT, TEST_KEY);
    const wrongKey = 'b'.repeat(64);
    expect(() => decryptCredential(blob, wrongKey)).toThrow();
  });
});
