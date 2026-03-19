import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptCredentials, encryptCredentials, hasEncryptionKey } from '../helpers/crypto.js';

describe('credential encryption', () => {
  const testKey = randomBytes(32).toString('hex');

  beforeEach(() => {
    vi.stubEnv('SETTINGS_ENCRYPTION_KEY', testKey);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('encrypts and decrypts back to the original plaintext', () => {
    const original = JSON.stringify({ username: 'user1', password: 's3cret' });
    const { encrypted, iv, tag } = encryptCredentials(original);
    const decrypted = decryptCredentials(encrypted, iv, tag);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertext for the same input (random IV)', () => {
    const original = 'same-text';
    const a = encryptCredentials(original);
    const b = encryptCredentials(original);
    expect(a.encrypted.equals(b.encrypted)).toBe(false);
    expect(a.iv.equals(b.iv)).toBe(false);
  });

  it('fails to decrypt with a tampered tag', () => {
    const { encrypted, iv, tag } = encryptCredentials('test');
    tag[0] ^= 0xff;
    expect(() => decryptCredentials(encrypted, iv, tag)).toThrow();
  });

  it('fails to decrypt with a wrong key', () => {
    const { encrypted, iv, tag } = encryptCredentials('test');
    vi.stubEnv('SETTINGS_ENCRYPTION_KEY', randomBytes(32).toString('hex'));
    expect(() => decryptCredentials(encrypted, iv, tag)).toThrow();
  });

  it('throws when no encryption key is set', () => {
    vi.stubEnv('SETTINGS_ENCRYPTION_KEY', '');
    expect(() => encryptCredentials('test')).toThrow('SETTINGS_ENCRYPTION_KEY');
  });

  it('hasEncryptionKey returns true when key is set', () => {
    expect(hasEncryptionKey()).toBe(true);
  });

  it('hasEncryptionKey returns false when key is empty', () => {
    vi.stubEnv('SETTINGS_ENCRYPTION_KEY', '');
    expect(hasEncryptionKey()).toBe(false);
  });
});
